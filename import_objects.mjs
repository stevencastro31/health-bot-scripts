import { setDocument } from './firestore.mjs';
import XLSX from 'xlsx';

async function importObjectsToFirestore() {
    // ! For latest version of the file, Export xlsx file from Google Sheets
    const workbook = XLSX.readFile('./Firestore.xlsx');
    const data = XLSX.utils.sheet_to_json(workbook.Sheets['Objects'], { defval: '' });
    const collection = 'health_knowledge_base';

    // Counter for tracking :>
    let documents_count = 0;

    for (const item of data) {
        // ! Replace string to limit to one document, otherwise comment this out
        // if (item.key !== 'association') continue;

        documents_count++;
        const new_object = {}

        console.log(`Document ${String(documents_count).padStart(2, '0')}: ${item.document}`);

        new_object[`${item.key}_objects`] = item.objects.split('\n').map(data => data.replace(/^\d+\.\s/, '').replace(/\r?\n|\r/, ''));

        await setDocument(collection, item.document, new_object);
    }
}

importObjectsToFirestore();