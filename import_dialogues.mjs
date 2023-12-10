import { deleteDocuments, getDocuments, setDocument, updateDocument } from './firestore.mjs'
import XLSX from 'xlsx';

// * Firestore update
async function importXLSXToFirestore() {
    // ! For latest version of the file, Export xlsx file from Google Sheets
    const workbook = XLSX.readFile('./Firestore.xlsx');
    const data = XLSX.utils.sheet_to_json(workbook.Sheets['Dialogues'], { defval: '' });
    const grouped_modules = groupModuleByDocument(data);

    // Counters for tracking :>
    let exceptions = [];
    let modules_count = 0;
    let total_documents_count = 0;

    for (const module in grouped_modules) {
        // ! Replace string to limit to one module, otherwise comment this out
        if (module !== 'general_module') continue;

        // ! This deletes ALL documents in the module
        await deleteDocuments(module);

        // Get array containing the documents of the current module
        const documents = grouped_modules[module];
        let documents_count = 0;
        modules_count++;

        for (const item in documents) {
            const document = documents[item];

            if (document.is_used == "No") continue;

            documents_count++;
            total_documents_count++;
            console.log(`Module ${String(modules_count).padStart(2, '0')} - ${module} | Document ${String(total_documents_count).padStart(3, '0')}: ${item}`);

            // Prepare the data for Firestore update
            const data = {
                qck_reply: {
                    cebuano_replies: [],
                    english_replies: [],
                    tagalog_replies: []
                },
                question_translation: {
                    cebuano_response: document.cebuano_question,
                    english_response: document.english_question,
                    tagalog_response: document.tagalog_question
                },
                voice_link: {
                    cebuano_audio: document.cebuano_voice_link,
                    english_audio: document.english_voice_link,
                    tagalog_audio: document.tagalog_voice_link
                }
            }

            // Check if quick replies are not empty
            if (document.english_replies && document.tagalog_replies && document.cebuano_replies) {
                const replies = formatReplies(document);
                data.qck_reply.cebuano_replies = replies.cebuano_replies;
                data.qck_reply.english_replies = replies.english_replies;
                data.qck_reply.tagalog_replies = replies.tagalog_replies;
            }

            // Firestore update
            await setDocument(module, item, data);
            // ! comment out deleteDocuments() if you will use updateDocument() instead of setDocument()
            // await updateDocument(module, item, data); 
        }
        exceptions = await compareXlsxAndFirestore(documents_count, module, exceptions);
    }
    console.log(`Module Documents Mismatch: ${exceptions.length ? exceptions : 'None'}`);
}

// * Compare document count of Xlsx data and Firestore data
async function compareXlsxAndFirestore(count, module, exceptions) {
    const document = await getDocuments(module);
    if (count !== document.length) {
        console.log(`Warning: XLSX data and Firestore data do not match for: ${module}`);
        exceptions.push(module);
    }
    return exceptions;
}

// * Group module by document name
function groupModuleByDocument(data) {
    const grouped_modules = {};

    data.forEach((item) => {
        const { module, document_name } = item;

        if (!grouped_modules[module]) {
            grouped_modules[module] = {};
        }

        if (!grouped_modules[module][document_name]) {
            grouped_modules[module][document_name] = {};
        }

        if (document_name) {
            grouped_modules[module][document_name] = item;
        }
    });

    return grouped_modules;
}

// * Format the quick replies for Firestore
function formatReplies(data) {
    let { english_replies, tagalog_replies, cebuano_replies } = data;

    // Use regex to remove the initial number (ex. "1. Choice" -> "Choice")
    english_replies = english_replies.split('\n').map(data => data.replace(/^\d+\.\s/, '').replace(/\r?\n|\r/, ''));
    tagalog_replies = tagalog_replies.split('\n').map(data => data.replace(/^\d+\.\s/, '').replace(/\r?\n|\r/, ''));
    cebuano_replies = cebuano_replies.split('\n').map(data => data.replace(/^\d+\.\s/, '').replace(/\r?\n|\r/, ''));

    return { english_replies, tagalog_replies, cebuano_replies };
}

importXLSXToFirestore();