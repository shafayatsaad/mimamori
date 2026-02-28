/**
 * Circuit breaker for external service calls.
 *
 * State machine:
 *   closed → open      after failureThreshold failures within windowMs
 *   open → half-open   after halfOpenMs has elapsed
 *   half-open → closed  on successful probe call
 *   half-open → open    on failed probe call
 *
 * While open, calls immediately throw without invoking the underlying function.
 */

export type ServiceName = 'bedrock' | 'comprehend-medical' | 'ses' | 'dynamodb';

export interface CircuitBreakerConfig {
  failureThreshold: number; // default 5
  windowMs: number;         // default 60000
  halfOpenMs: number;       // default 30000
}

interface CircuitState {
  failures: number;
  lastFailureTime: number;
  state: 'closed' | 'open' | 'half-open';
  lastStateChange: number;
}

const DEFAULT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  windowMs: 60_000,
  halfOpenMs: 30_000,
};

const circuitStates = new Map<ServiceName, CircuitState>();

function getState(service: ServiceName): CircuitState {
  let state = circuitStates.get(service);
  if (!state) {
    state = {
      failures: 0,
      lastFailureTime: 0,
      state: 'closed',
      lastStateChange: Date.now(),
    };
    circuitStates.set(service, state);
  }
  return state;
}

export async function callWithCircuitBreaker<T>(
  service: ServiceName,
  fn: () => Promise<T>,
  config?: Partial<CircuitBreakerConfig>,
): Promise<T> {
  const cfg: CircuitBreakerConfig = { ...DEFAULT_CONFIG, ...config };
  const circuit = getState(service);
  const now = Date.now();

  if (circuit.state === 'open') {
    // Check if enough time has passed to transition to half-open
    if (now - circuit.lastStateChange >= cfg.halfOpenMs) {
      circuit.state = 'half-open';
      circuit.lastStateChange = now;
    } else {
      throw new Error(`Circuit breaker is open for service: ${service}`);
    }
  }

  if (circuit.state === 'half-open') {
    // Allow one probe request
    try {
      const result = await fn();
      // Probe succeeded — close the circuit
      circuit.state = 'closed';
      circuit.failures = 0;
      circuit.lastFailureTime = 0;
      circuit.lastStateChange = Date.now();
      return result;
    } catch (error) {
      // Probe failed — reopen the circuit
      circuit.state = 'open';
      circuit.lastStateChange = Date.now();
      circuit.lastFailureTime = Date.now();
      throw error;
    }
  }

  // State is closed — normal operation
  try {
    const result = await fn();
    return result;
  } catch (error) {
    const failTime = Date.now();

    // If previous failures are outside the window, reset counter
    if (
      circuit.failures > 0 &&
      circuit.lastFailureTime > 0 &&
      failTime - circuit.lastFailureTime > cfg.windowMs
    ) {
      circuit.failures = 1;
    } else {
      circuit.failures += 1;
    }

    circuit.lastFailureTime = failTime;

    if (circuit.failures >= cfg.failureThreshold) {
      circuit.state = 'open';
      circuit.lastStateChange = failTime;
    }

    throw error;
  }
}

/** Reset a circuit breaker to its initial closed state. Useful for testing. */
export function resetCircuitBreaker(service: ServiceName): void {
  circuitStates.delete(service);
}
