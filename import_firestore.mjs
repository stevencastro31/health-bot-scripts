import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import XLSX from 'xlsx';
import dotenv from 'dotenv';

dotenv.config();

const serviceAccount = {
    type: process.env.TYPE,
    project_id: process.env.PROJECT_ID,
    private_key_id: process.env.PRIVATE_KEY_ID,
    private_key: process.env.PRIVATE_KEY.split(String.raw`\n`).join('\n'),
    client_email: process.env.CLIENT_EMAIL,
    client_id: process.env.CLIENT_ID,
    auth_uri: process.env.AUTH_URI,
    token_uri: process.env.TOKEN_URI,
    auth_provider_x509_cert_url: process.env.AUTH_PROVIDER_X509_CERT_URL,
    client_x509_cert_url: process.env.CLIENT_X509_CERT_URL
};

initializeApp({
    credential: cert(serviceAccount)
});

const db = getFirestore();

// * Firestore update
async function importXLSXToFirestore() {
    // ! For latest version of the file, Export xlsx file from Google Sheets
    const workbook = XLSX.readFile('./Firestore.xlsx');
    const data = XLSX.utils.sheet_to_json(workbook.Sheets['Reference'], { defval: '' });
    const grouped_modules = groupModuleByDocument(data);

    // Counters for tracking :>
    let modules_count = 0;
    let documents_count = 0;

    for (const module in grouped_modules) {
        // ! Replace string to limit to one module, otherwise comment this out
        // if (module !== 'allergy_module') continue;

        // ! This deletes ALL documents
        await deleteCurrentDocuments(module); 
        
        // Get array containing the documents of the current module
        const documents = grouped_modules[module];
        modules_count++;

        for (const item in documents) {
            documents_count++;
            console.log(`Module ${String(modules_count).padStart(2, '0')} - ${module} | Document ${String(documents_count).padStart(3, '0')}: ${item}`);

            // Prepare the data for Firestore update
            const data = {
                qck_reply: {
                    cebuano_replies: [],
                    english_replies: [],
                    tagalog_replies: []
                },
                question_translation: {
                    cebuano_response: documents[item].cebuano_question,
                    english_response: documents[item].english_question,
                    tagalog_response: documents[item].tagalog_question
                },
                voice_link: {
                    cebuano_audio: documents[item].cebuano_voice_link,
                    english_audio: documents[item].english_voice_link,
                    tagalog_audio: documents[item].tagalog_voice_link
                }
            }

            // Check if quick replies are not empty
            if (documents[item].english_replies && documents[item].tagalog_replies && documents[item].cebuano_replies) {
                const replies = formatReplies(documents[item]);
                data.qck_reply.cebuano_replies = replies.cebuano_replies;
                data.qck_reply.english_replies = replies.english_replies;
                data.qck_reply.tagalog_replies = replies.tagalog_replies;
            }

            // Firestore update
            try {
                await db.collection(module).doc(item).set(data); // ! Overwrites document
            }
            catch (error) {
                console.error(`Update Error | ${module} - ${item}:`, error);
            }
        }
    }
}

// * Group module by document name
function groupModuleByDocument(data) {
    const grouped_modules = {};

    data.forEach((item) => {
        const { module, document_name } = item;

        if (!grouped_modules[module]) { grouped_modules[module] = {}; }

        if (!grouped_modules[module][document_name]) { grouped_modules[module][document_name] = {}; }

        if (document_name) {
            grouped_modules[module][document_name] = item;
        }
    });

    return grouped_modules;
}

// * Delete every documents in each module
async function deleteCurrentDocuments(module_name) {
    const collection = db.collection(module_name);

    try {
        const data = await collection.get();

        for (const item of data.docs) {
            try {
                await collection.doc(item.id).delete();
            } catch (delete_error){
                console.error(`Delete Error | ${module_name} - ${item.id}:`, delete_error);
            }
        }
    } catch (fetch_error) {
        console.error(`Fetch Error | ${module_name}:`, fetch_error);
    }
}

// * Format the quick replies for Firestore
function formatReplies(data) {
    let { english_replies, tagalog_replies, cebuano_replies } = data;
    
    // Use regex to remove the initial number (ex. "1. Choice")
    english_replies = english_replies.split('\n').map(data => data.replace(/^\d+\.\s/, '').replace(/\r?\n|\r/, ''));
    tagalog_replies = tagalog_replies.split('\n').map(data => data.replace(/^\d+\.\s/, '').replace(/\r?\n|\r/, ''));
    cebuano_replies = cebuano_replies.split('\n').map(data => data.replace(/^\d+\.\s/, '').replace(/\r?\n|\r/, ''));

    return { english_replies, tagalog_replies, cebuano_replies };
}

importXLSXToFirestore();