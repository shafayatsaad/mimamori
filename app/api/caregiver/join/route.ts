import { NextResponse } from 'next/server';
import { ScanCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import docClient from '@/lib/dynamodb';
import { getConfig } from '@/lib/config-service';

const TABLE_NAME = getConfig().aws.dataTable;

export async function POST(request: Request) {
  try {
    const { code, selfName } = await request.json();

    if (!code) {
      return NextResponse.json({ error: 'Missing invitation code' }, { status: 400 });
    }

    const upperCode = code.toUpperCase();

    // Query all PROFILES in the Single-Table Design to locate the invitation code
    const scanResult = await docClient.send(
      new ScanCommand({
        TableName: TABLE_NAME,
        FilterExpression: 'SK = :sk',
        ExpressionAttributeValues: { ':sk': 'PROFILE' }
      })
    );

    let matchingPatient = null;
    let matchingInviteIndex = -1;
    let matchingInvite = null;

    for (const userProfile of scanResult.Items || []) {
      const invites = userProfile.invitations || [];
      const index = invites.findIndex((inv: any) => inv.code.toUpperCase() === upperCode);
      if (index !== -1) {
        matchingPatient = userProfile;
        matchingInviteIndex = index;
        matchingInvite = invites[index];
        break;
      }
    }

    if (!matchingPatient) {
        // Configurable demo mode: only check demo code when DEMO_MODE is enabled
        const config = getConfig();
        if (
          config.demo.enabled &&
          config.demo.joinCode !== '' &&
          upperCode === config.demo.joinCode.toUpperCase()
        ) {
             for (const userProfile of scanResult.Items || []) {
                  if (userProfile.caregivers && userProfile.caregivers.length > 0) {
                      return NextResponse.json({ 
                          message: 'Demo joined', 
                          patientEmail: userProfile.email, 
                          caregiverId: userProfile.caregivers[0].id 
                      }, { status: 200 });
                  }
             }
        }
        return NextResponse.json({ error: 'Invalid or expired invitation code' }, { status: 404 });
    }

    // Move the invite to an active caregiver
    const newCaregiverId = crypto.randomUUID(); // Secure UUID based linking
    const newCaregiver = {
      id: newCaregiverId,
      name: matchingInvite.name,
      selfName: selfName || matchingInvite.name,
      role: matchingInvite.role,
      image: '/images/family-care-photo-hd.png', // Default image
      integration: 'App User',
      permissions: matchingInvite.permissions || ['Alerts', 'Diary', 'Vault']
    };

    const updatedCaregivers = [...(matchingPatient.caregivers || []), newCaregiver];
    const updatedInvites = matchingPatient.invitations.filter((_: any, i: number) => i !== matchingInviteIndex);

    // Overwrite the specific user's PROFILE record
    await docClient.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: {
           ...matchingPatient,
           caregivers: updatedCaregivers,
           invitations: updatedInvites
        }
      })
    );

    return NextResponse.json({ 
        message: 'Caregiver joined successfully', 
        patientEmail: matchingPatient.email, 
        caregiverId: newCaregiverId 
    }, { status: 200 });

  } catch (error) {
    console.error('Caregiver join error:', error);

    const errorName = error && typeof error === 'object' && 'name' in error
      ? String((error as { name?: string }).name)
      : '';

    if (errorName === 'ResourceNotFoundException') {
      return NextResponse.json({ error: `Data table '${TABLE_NAME}' was not found` }, { status: 503 });
    }

    return NextResponse.json({ error: 'Internal server error joining via code' }, { status: 500 });
  }
}
