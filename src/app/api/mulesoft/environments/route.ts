import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const possibleEnvs = ['UAT', 'SIT', 'PROD'];
    const availableEnvironments = possibleEnvs.filter((env) => {
      const clientId = process.env[`MULESOFT_${env}_CLIENT_ID`];
      const clientSecret = process.env[`MULESOFT_${env}_CLIENT_SECRET`];
      const endpoint = process.env[`MULESOFT_${env}_ENDPOINT`];
      return clientId && clientSecret && endpoint;
    });

    return NextResponse.json({
      status: 'success',
      data: availableEnvironments,
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: 'error',
        error: error instanceof Error ? error.message : 'Failed to fetch environments',
      },
      { status: 500 }
    );
  }
}
