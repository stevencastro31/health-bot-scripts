import { PagesClient, FlowsClient } from '@google-cloud/dialogflow-cx';
import XLSX from 'xlsx';

const AGENT_ID = process.env.CX_BOT_ID;
const PROJECT_ID = process.env.CX_PROJECT_ID;
const LOCATION = 'global';

const credentials = {
    client_email: process.env.CX_CLIENT_EMAIL,
    private_key: process.env.CX_CLIENT_KEY.split(String.raw`\n`).join('\n'),
};

const pagesClient = new PagesClient({ credentials: credentials });
const flowsClient = new FlowsClient({ credentials: credentials });

