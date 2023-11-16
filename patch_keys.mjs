import { PagesClient, FlowsClient } from '@google-cloud/dialogflow-cx';
import XLSX from 'xlsx';

import { config } from 'dotenv';
config();

const AGENT_ID = process.env.CX_TEMP_BOT_ID;
const PROJECT_ID = process.env.CX_PROJECT_ID;
const LOCATION = 'global';

const credentials = {
    client_email: process.env.CX_CLIENT_EMAIL,
    private_key: process.env.CX_CLIENT_KEY.split(String.raw`\n`).join('\n'),
};

const pagesClient = new PagesClient({ credentials: credentials });
const flowsClient = new FlowsClient({ credentials: credentials });

const allPages = {};
const allFlows = [];

const workbook = XLSX.readFile('./Chatbot Response Keys.xlsx');
const changes = XLSX.utils.sheet_to_json(workbook.Sheets['keys']);

await listFlows(allFlows);
allFlows.forEach(flow => { allPages[flow.name] = {}});
const requests = [];
for(let i = 0; i < allFlows.length; i++) { 
    requests.push(listPages(allFlows[i])); 
};
await Promise.all(requests);

async function listPages(flow) {
    const pages = await pagesClient.listPages({
        languageCode: 'en',
        parent: pagesClient.flowPath(PROJECT_ID, LOCATION, AGENT_ID, flow.id),    
    });

    pages[0].forEach(page => {
        allPages[flow.name][page.displayName] = page;
    });
};

async function listFlows(flow_list) {
    const flows = await flowsClient.listFlows({
        languageCode: 'en',
        parent: flowsClient.agentPath(PROJECT_ID, LOCATION, AGENT_ID),
    });

    flows[0].forEach(flow => {
        flow_list.push({
            id: flow.name.split('/')[7],
            name: flow.displayName});
    });
};

function updateChanges() {
    changes.forEach(change => {
        let type = change.type
        let old_key = change.key;
        let new_key = change.new_key;
        let page = change.page;
        let flow = change.module;

        if (type === 'Actions') {
            let params = allPages[flow][page].form.parameters;
            params.forEach(param => {
                let actions = param.fillBehavior.initialPromptFulfillment?.setParameterActions;
                actions.forEach(action => {
                    if (action.parameter === 'custom_response_key' && action.value.stringValue === old_key) {
                        action.value.stringValue = new_key;
                        console.log(`A: Updated -> ${new_key}`);
                    }
                }); 
            });
        }

        if (type === 'Reprompt') {
            let params = allPages[flow][page].form.parameters;
            params.forEach(param => {
                let reprompts = param.fillBehavior.repromptEventHandlers;
                reprompts.forEach(reprompt => {
                    let actions = reprompt.triggerFulfillment.setParameterActions;
                    actions.forEach(action => {
                        if (action.parameter === 'custom_response_key' && action.value.stringValue === old_key) {
                            action.value.stringValue = new_key;
                            console.log(`P: Updated -> ${new_key}`);
                        }
                    });
                }); 
            });
        }

        if (type === 'Routes') {
            let routes = allPages[flow][page].transitionRoutes;
            routes.forEach(route => {
                let actions = route.triggerFulfillment.setParameterActions;
                actions.forEach(action => {
                    if (action.parameter === 'custom_response_key' && action.value.stringValue === old_key) {
                        action.value.stringValue = new_key;
                        console.log(`R: Updated -> ${new_key}`);
                    }
                });
            });
        }
    });
};

function applyChanges(flow) {
    console.log(`Updating Flow: ${flow}`);
    const pages = allPages[flow];
    Object.keys(pages).forEach(pageName => {
        let page = pages[pageName];
        pagesClient.updatePage({
            page: pages[pageName],
            languageCode: 'en',
            updateMask: ['form', 'transitionRoutes'],
        }).then(res => {
            console.log(`-> Updated Page: ${page.displayName}`);
        });
    });
};

// 18 Total Flows
updateChanges();
let flow_name = 'Default Start Flow';
applyChanges(allFlows[flow_name]);