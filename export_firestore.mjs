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

// * Firestore fetch
async function exportFirestoreToXLSX() {
    const collections = await getCollectionNames();
    let dialogues = [];

    // Counters for tracking :>
    let modules_count = 0;
    let documents_count = 0;
    let contains_objects_count = 0;
    let skipped_documents_count = 0;

    for (const collection of collections) {

        // ! Replace string to limit to one module, otherwise comment this out
        // if (collection !== 'allergy_module') continue;

        try {
            const current_module = await db.collection(collection).get();
            modules_count++;
    
            for (let document of current_module.docs) {
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
    
                // ! Will probably remove the following once there are no questions that use '$session.params.cur-obj'
                const contains_object = {
                    english: data.question_translation.english_response.includes('$session.params.cur-obj'),
                    tagalog: data.question_translation.tagalog_response.includes('$session.params.cur-obj'),
                    cebuano: data.question_translation.cebuano_response.includes('$session.params.cur-obj')
                }
                let objects = {};
    
                // Get objects from health knowledge base
                if (contains_object.cebuano || contains_object.english || contains_object.tagalog) {
    
                    const { hkb_collection, hkb_document, hkb_language } = getCurrentObjectPath(collection, document.id, contains_object);
                    const objects_array = await getObjectsData(hkb_collection, hkb_document, hkb_language);
    
                    objects.english = contains_object.english ? objects_array.english : null;
                    objects.tagalog = contains_object.tagalog ? objects_array.tagalog : null;
                    objects.cebuano = contains_object.cebuano ? objects_array.cebuano : null;
    
                    contains_objects_count++;
    
                    if (!objects.english && !objects.tagalog && !objects.cebuano) {
                        console.log(`Problem: Translations do not match for ${collection} - ${document.id}`);
                    }
                }
    
                if (row.document_name && objects.english && objects.tagalog && objects.cebuano) {
                    // dialogues.push(row); // ! Will remove this
                    dialogues = pushTemplatedQuestions(objects, row, dialogues);
                }
                else if (!row.document_name) {
                    skipped_documents_count++;
                }
                else {
                    dialogues.push(row);
                }
    
            }
        } catch (error) {
            console.error(`Fetch Error | ${collection}:`, error);
        }
    }

    console.log(`Documents that contains objects: ${contains_objects_count}`);
    console.log(`Documents skipped: ${skipped_documents_count}`);

    // Export to XLSX
    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.json_to_sheet(dialogues);
    XLSX.utils.book_append_sheet(workbook, sheet, 'Reference');
    XLSX.writeFile(workbook, 'Firestore.xlsx');
}

// * Fetch collection names from Firestore
async function getCollectionNames() {
    try {
        const excluded = ['children_health_data', 'health_knowledge_base'];
        const collections = await db.listCollections();
        const collection_names = collections.map((collection) => collection.id);
        const filtered_names = collection_names.filter((item) => !excluded.includes(item));
    
        return filtered_names;
    } catch (error) {
        console.error('Fetch Error | Collections:', error);
        return [];
    }
}

// * Determines which document to get object from in Firestore
function getCurrentObjectPath(key, document, contains_object) {

    let hkb_collection = 'health_knowledge_base';
    let hkb_document;
    let hkb_language = {};
    const { english, tagalog, cebuano } = contains_object;

    switch (key) {
        case 'allergy_module':
            hkb_document = 'allergies';
            hkb_language.cebuano = 'allergy_cebuano';
            hkb_language.english = 'allergy_english';
            hkb_language.tagalog = 'allergy_tagalog';
            break;
        case 'buto_and_muscle_module':
            if (document.endsWith('-remedy') && (english || tagalog || cebuano)) {
                hkb_document = 'bm_remedies';
                hkb_language.cebuano = 'bmr_cebuano';
                hkb_language.english = 'bmr_english';
                hkb_language.tagalog = 'bmr_tagalog';
            }
            else {
                hkb_document = 'bmcs';
                hkb_language.cebuano = 'bmc_cebuano';
                hkb_language.english = 'bmc_english';
                hkb_language.tagalog = 'bmc_tagalog';
            }
            break;
        case 'cough_and_cold_module':
            hkb_document = 'ccfs';
            hkb_language.cebuano = 'ccf_cebuano';
            hkb_language.english = 'ccf_english';
            hkb_language.tagalog = 'ccf_tagalog';
            break;
        case 'ear_module':
            hkb_document = 'earproblems';
            hkb_language.cebuano = 'earp_cebuano';
            hkb_language.english = 'earp_english';
            hkb_language.tagalog = 'earp_tagalog';
            break;
        case 'eyes_module':
            hkb_document = 'eyeproblems';
            hkb_language.cebuano = 'eyep_cebuano';
            hkb_language.english = 'eyep_english';
            hkb_language.tagalog = 'eyep_tagalog';
            break;
        case 'family_history_module':
            hkb_document = 'family_histories_diseases';
            hkb_language.cebuano = 'fhd_cebuano';
            hkb_language.english = 'fhd_english';
            hkb_language.tagalog = 'fhd_tagalog';
            break;
        case 'head_module':
            if (document === 'confirm-head' && (english || tagalog || cebuano)) {
                hkb_document = 'heads';
                hkb_language.cebuano = 'head_cebuano';
                hkb_language.english = 'head_english';
                hkb_language.tagalog = 'head_tagalog';
            }
            else {
                hkb_document = 'ache_associations';
                hkb_language.cebuano = 'association_cebuano';
                hkb_language.english = 'association_english';
                hkb_language.tagalog = 'association_tagalog';
            }
            break;
        case 'heart_lungs_module':
            hkb_document = 'heartproblems';
            hkb_language.cebuano = 'hlp_cebuano';
            hkb_language.english = 'hlp_english';
            hkb_language.tagalog = 'hlp_tagalog';
            break;
        case 'mouth_throat_teeth_module':
            hkb_document = 'mtthproblems';
            hkb_language.cebuano = 'mtth_cebuano';
            hkb_language.english = 'mtth_english';
            hkb_language.tagalog = 'mtth_tagalog';
            break;
        case 'skin_module':
            hkb_document = 'skcos';
            hkb_language.cebuano = 'skco_cebuano';
            hkb_language.english = 'skco_english';
            hkb_language.tagalog = 'skco_tagalog';
            break;
        case 'daily_living_scale_module':
        case 'endocrine_module':
        case 'general_module':
        case 'gi_module':
        case 'gu_module':
        case 'mental_health_module':
        case 'nose_module':
        default:
            break;
    }

    return { hkb_collection, hkb_document, hkb_language }
}

// * Fetches the objects from Firestore
async function getObjectsData(hkb_collection, hkb_document, hkb_language) {
    try {
        const objects = await db.collection(hkb_collection).doc(hkb_document).get();
        const obj_document = {
            english: objects.data()[hkb_language.english],
            tagalog: objects.data()[hkb_language.tagalog],
            cebuano: objects.data()[hkb_language.cebuano]
        };
        
        return obj_document;
    } catch (error) {
        console.error(`Fetch Error | ${hkb_collection} - ${hkb_document}:`, error);
        return {};
    }
}

// * Push multiple rows based on the number of objects
function pushTemplatedQuestions(objects, row, dialogues) {

    for (let i = 0; i < objects['english'].length; i++) {

        let new_row = {
            module: row.module,
            document_name: row.document_name,
            english_question: row.english_question.replace('$session.params.cur-obj', objects['english'][i]),
            english_replies: row.english_replies,
            tagalog_question: row.tagalog_question.replace('$session.params.cur-obj', objects['tagalog'][i]),
            tagalog_replies: row.tagalog_replies,
            cebuano_question: row.cebuano_question.replace('$session.params.cur-obj', objects['cebuano'][i]),
            cebuano_replies: row.cebuano_replies,
            english_voice_link: row.english_voice_link,
            tagalog_voice_link: row.tagalog_voice_link,
            cebuano_voice_link: row.cebuano_voice_link
        }

        dialogues.push(new_row);
    }

    return dialogues;
}

exportFirestoreToXLSX();