import { getCollections, getDocuments } from './firestore.mjs';
import XLSX from 'xlsx';

// * Firestore fetch
async function exportFirestoreToXLSX() {
    const collections = await getCollectionNames();
    let dialogues = [];

    // Counters for tracking :>
    let modules_count = 0;
    let documents_count = 0;

    for (const collection of collections) {
        // ! Replace string to limit to one module, otherwise comment this out
        // if (collection !== 'allergy_module') continue;

        const current_module = await getDocuments(collection);
        modules_count++;

        for (let document of current_module) {
            documents_count++;
            console.log(`Module ${String(modules_count).padStart(2, '0')} - ${collection} | Document ${String(documents_count).padStart(3, '0')}: ${document.id}`);

            const data = document.data();
            const replies = {
                english: [],
                tagalog: [],
                cebuano: []
            }

            // Format replies
            if (data.qck_reply) {
                const english_length = data.qck_reply.english_replies.length;
                const tagalog_length = data.qck_reply.tagalog_replies.length;
                const cebuano_length = data.qck_reply.cebuano_replies.length;

                if (english_length === tagalog_length && cebuano_length === english_length) {
                    for (let i = 0; i < data.qck_reply.english_replies.length; i++) {
                        replies.english.push(`${i + 1}. ${data.qck_reply.english_replies[i].trim()}`);
                        replies.tagalog.push(`${i + 1}. ${data.qck_reply.tagalog_replies[i].trim()}`);
                        replies.cebuano.push(`${i + 1}. ${data.qck_reply.cebuano_replies[i].trim()}`);
                    }
                }
                else {
                    console.log(`Problem: Quick Replies do not match for ${collection} - ${document.id}`);
                }
            }

            // Initialize current document row
            const row = {
                module: document.ref.parent.id,
                document_name: document.id,
                english_question: data.question_translation.english_response.trim(),
                english_replies: replies.english.join('\n'),
                tagalog_question: data.question_translation.tagalog_response.trim(),
                tagalog_replies: replies.tagalog.join('\n'),
                cebuano_question: data.question_translation.cebuano_response.trim(),
                cebuano_replies: replies.cebuano.join('\n'),
                english_voice_link: data.voice_link.english_audio,
                tagalog_voice_link: data.voice_link.tagalog_audio,
                cebuano_voice_link: data.voice_link.cebuano_audio
            }

            dialogues.push(row);
        }

    }

    // Export to XLSX
    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.json_to_sheet(dialogues);
    XLSX.utils.book_append_sheet(workbook, sheet, 'Export');
    XLSX.writeFile(workbook, 'Firestore.xlsx');
}

// * Fetch collection names from Firestore
async function getCollectionNames() {
    const excluded = ['children_health_data', 'health_knowledge_base'];
    const collections = await getCollections();
    const filtered_names = collections.filter((item) => !excluded.includes(item));

    return filtered_names;
}

exportFirestoreToXLSX();