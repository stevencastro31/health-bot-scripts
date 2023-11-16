import { PagesClient, FlowsClient } from '@google-cloud/dialogflow-cx';
import XLSX from 'xlsx';

import { config } from 'dotenv';
config();

const AGENT_ID = process.env.CX_BOT_ID;
const PROJECT_ID = process.env.CX_PROJECT_ID;
const LOCATION = 'global';

const credentials = {
    client_email: process.env.CX_CLIENT_EMAIL,
    private_key: process.env.CX_CLIENT_KEY.split(String.raw`\n`).join('\n'),
};

const pagesClient = new PagesClient({ credentials: credentials });
const flowsClient = new FlowsClient({ credentials: credentials });
let no = 1;

const data = []

const listKeys = async (name, flowKey) => {
    const pages = await pagesClient.listPages({
        languageCode: 'en',
        parent: pagesClient.flowPath(PROJECT_ID, LOCATION, AGENT_ID, flowKey),    
    });

    pages[0].forEach(page => {
        let params = page.form?.parameters ?? [];
        let page_key = page.name.split('/')[9];
        if (params) {
            params.forEach(param => {
                let actions = param.fillBehavior.initialPromptFulfillment?.setParameterActions;
                let reprompts = param.fillBehavior.repromptEventHandlers;
                
                actions.forEach(action => {
                    if (action.parameter === 'custom_response_key') { 
                        data.push({
                            id: no,
                            module: name,
                            page: page.displayName,
                            type: 'Actions',
                            key: action.value.stringValue,
                            // module_key: flowKey,
                            // page_key: page_key,
                        });
                        // console.log(`${no} | ${page.displayName} | Action | ${action.parameter}: ${action.value.stringValue}`);
                        no++;
                    }
                });
            reprompts.forEach(reprompt => {
                    let aksyons = reprompt.triggerFulfillment.setParameterActions;
                    aksyons.forEach(aksyon => {
                        if (aksyon.parameter === 'custom_response_key') {
                            data.push({
                                id: no,
                                module: name,
                                page: page.displayName,
                                type: 'Reprompt',
                                key: aksyon.value.stringValue,
                                // module_key: flowKey,
                                // page_key: page_key,
                            });
                            // console.log(`${no} | ${page.displayName} | Reprompt | ${aksyon.parameter}: ${aksyon.value.stringValue}`);
                            no++;
                        }
                    })
                });
            });
        }

        let routes = page.transitionRoutes;
        routes.forEach(route => {
            let acshons = route.triggerFulfillment?.setParameterActions;

            acshons.forEach(acshon => {
                if (acshon.parameter === 'custom_response_key') {
                    data.push({
                        id: no,
                        module: name,
                        page: page.displayName,
                        type: 'Routes',
                        key: acshon.value.stringValue,
                        // module_key: flowKey,
                        // page_key: page_key,
                    });
                    // console.log(`${no} | ${page.displayName} | Routes | ${acshon.parameter}: ${acshon.value.stringValue}`);
                    no++
                }
            });
        });
    });
};

const listFlows = async(keys) => {
    const flows = await flowsClient.listFlows({
        languageCode: 'en',
        parent: flowsClient.agentPath(PROJECT_ID, LOCATION, AGENT_ID),
    });

    flows[0].forEach(flow => {
        keys.push({
            id: flow.name.split('/')[7],
            name: flow.displayName});
    });
};

// GetModule Keys
const keys = [];
await listFlows(keys);

// Find Response Keys
const requests = [];

keys.forEach(key => {
    requests.push(listKeys(key.name, key.id));
});

await Promise.all(requests);

// Write
const workbook = XLSX.utils.json_to_sheet(data);
const new_book = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(new_book, workbook, 'keys')
XLSX.writeFile(new_book, 'Keys.xlsx');


