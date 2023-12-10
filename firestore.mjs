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

// * Fetch all module names
export async function getCollections() {
    try {
        const collections = await db.listCollections();
        const response = collections.map((collection) => collection.id);

        return response;
    } catch (fetch_error) {
        console.error('Fetch Error | Collections:', fetch_error);

        return null;
    }
}

// * Fetch single document
export async function getDocuments(collection) {
    try {
        const data = await db.collection(collection).get();
        const response = data.docs;

        return response;
    } catch (fetch_error) {
        console.error(`Fetch Error | ${collection}:`, fetch_error);

        return null;
    }
}

// * Fetch all documents in a module
export async function getDocument(collection, document) {
    try {
        const doc = await db.collection(collection).doc(document).get();
        const response = doc.data();

        return response;
    } catch (fetch_error) {
        console.error(`Fetch Error | ${collection} - ${document}:`, fetch_error);

        return null;
    }
}

// * Specific change to document
export async function updateDocument(collection, document, data) {
    try {
        await db.collection(collection).doc(document).update(data);
    } catch (update_error) {
        console.error(`Update Error | ${collection} - ${document}:`, update_error);
    }
}

// * Overwrite document
export async function setDocument(collection, document, data) {
    try {
        await db.collection(collection).doc(document).set(data);
    } catch (update_error) {
        console.error(`Update Error | ${collection} - ${document}:`, update_error);
    }
}

// * Delete specific document
export async function deleteDocument(collection, document) {
    try {
        await db.collection(collection).doc(document).delete();
    } catch (delete_error) {
        console.error(`Delete Error | ${collection} - ${document}:`, delete_error);
    }
}

// * Delete all documents (clear collection)
export async function deleteDocuments(collection) {
    try {
        const data = await getDocuments(collection);

        for (const document of data) {
            await deleteDocument(collection, document.id);
        }
    } catch (delete_error) {
        console.error(`Delete Error | ${collection}:`, delete_error);
    }
}

// * You can perform firestore operations here: 
async function main() {
    // Edit parameters:
    const collection = 'general_module';
    const document = 'get-age';
    const dialogue = {
        qck_reply: {
            cebuano_replies: [],
            english_replies: [],
            tagalog_replies: []
        },
        question_translation: {
            cebuano_response: 'question 1',
            english_response: 'question 2',
            tagalog_response: 'question 3'
        },
        voice_link: {
            cebuano_audio: 'cebuano sample',
            english_audio: '',
            tagalog_audio: 'tagalog sample'
        }
    }

    // * Fetch all module names
    // const collections_list = await getCollections();
    // console.log(collections_list);

    // * Fetch single document
    // const document_get = await getDocument(collection, document);
    // console.log(document_get);

    // * Fetch all documents in a module
    // const documents_get = await getDocuments(collection);
    // for (const document of documents_get) {
    //     console.log(document.data());
    // }

    // * Specific change to document
    // const update_changes = {
    //     'qck_reply.tagalog_replies': ['Oo', 'Hindi'],
    //     'voice_link.cebuano_audio': dialogue.voice_link.cebuano_audio,
    //     'question_translation': dialogue.question_translation
    // }
    // await updateDocument(collection, document, update_changes);

    // * Overwrite document
    // await setDocument(collection, document, dialogue);

    // * Delete specific document
    // await deleteDocument(collection, document);

    // * Delete all documents (clear collection)
    // await deleteDocuments(collection);
}

// ! remove comment to use
// main();