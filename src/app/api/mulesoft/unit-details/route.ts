import { NextRequest, NextResponse } from 'next/server';

interface MulesoftUnitDetail {
  unit_number?: string;
  Unit_Number?: string;
  [key: string]: any;
}

// Helper function to get available environments
export function getAvailableEnvironments(): string[] {
  const possibleEnvs = ['UAT', 'SIT', 'PROD'];
  return possibleEnvs.filter((env) => {
    const clientId = process.env[`MULESOFT_${env}_CLIENT_ID`];
    const clientSecret = process.env[`MULESOFT_${env}_CLIENT_SECRET`];
    const endpoint = process.env[`MULESOFT_${env}_ENDPOINT`];
    return clientId && clientSecret && endpoint;
  });
}

async function fetchUnitDetails(
  endpoint: string,
  clientId: string,
  clientSecret: string,
  communityName: string
): Promise<MulesoftUnitDetail[]> {
  console.log(`Calling endpoint: ${endpoint}`);
  console.log(`Community Name: ${communityName}`);

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'client_id': clientId,
      'client_secret': clientSecret,
    },
    body: JSON.stringify({
      PV_Community_Name: communityName,
    }),
  });

  const data = await response.json();
  console.log(`Response status: ${response.status}`);
  console.log(`Response data:`, data);

  if (!response.ok) {
    throw new Error(`Failed to fetch unit details: ${response.statusText}`);
  }

  // Handle different response formats
  let units: MulesoftUnitDetail[] = [];

  if (Array.isArray(data)) {
    units = data;
  } else if (data.units && Array.isArray(data.units)) {
    units = data.units;
  } else if (data.data && Array.isArray(data.data)) {
    units = data.data;
  } else if (typeof data === 'object') {
    // Try to find an array in the response
    for (const [key, value] of Object.entries(data)) {
      if (Array.isArray(value)) {
        units = value;
        console.log(`Found units array under key: ${key}`);
        break;
      }
    }
  }

  console.log(`Extracted ${units.length} units from response`);
  return units;
}

export async function POST(request: NextRequest) {
  try {
    const { environments, communityName } = await request.json();

    console.log(`\n=== Mulesoft API Request ===`);
    console.log(`Environments: ${environments.join(', ')}`);
    console.log(`Community Name: ${communityName}`);

    if (!environments || environments.length === 0) {
      return NextResponse.json(
        { status: 'error', error: 'At least one environment must be selected' },
        { status: 400 }
      );
    }

    if (!communityName) {
      return NextResponse.json(
        { status: 'error', error: 'Community name is required' },
        { status: 400 }
      );
    }

    const results: Record<string, MulesoftUnitDetail[]> = {};
    const errors: Record<string, string> = {};

    for (const env of environments) {
      const envUpper = env.toUpperCase();
      const clientId = process.env[`MULESOFT_${envUpper}_CLIENT_ID`];
      const clientSecret = process.env[`MULESOFT_${envUpper}_CLIENT_SECRET`];
      const endpoint = process.env[`MULESOFT_${envUpper}_ENDPOINT`];

      console.log(`\n--- Processing ${env} ---`);
      console.log(`Client ID: ${clientId ? '✓' : '✗'}`);
      console.log(`Client Secret: ${clientSecret ? '✓' : '✗'}`);
      console.log(`Endpoint: ${endpoint ? '✓' : '✗'}`);

      if (!clientId || !clientSecret || !endpoint) {
        const error = `Missing Mulesoft credentials for environment: ${env}`;
        console.error(error);
        errors[env] = error;
        results[env] = [];
        continue;
      }

      try {
        const units = await fetchUnitDetails(endpoint, clientId, clientSecret, communityName);
        results[env] = units;
        console.log(`✓ Successfully fetched ${units.length} units from ${env}`);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.error(`✗ Error fetching from ${env}: ${errorMsg}`);
        errors[env] = errorMsg;
        results[env] = [];
      }
    }

    console.log(`\n=== Final Results ===`);
    Object.entries(results).forEach(([env, units]) => {
      console.log(`${env}: ${units.length} units`);
    });

    return NextResponse.json({
      status: 'success',
      data: results,
      ...(Object.keys(errors).length > 0 && { errors }),
    });
  } catch (error) {
    console.error('Error fetching Mulesoft data:', error);
    return NextResponse.json(
      {
        status: 'error',
        error: error instanceof Error ? error.message : 'Failed to fetch unit details',
      },
      { status: 500 }
    );
  }
}
