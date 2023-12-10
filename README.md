# Health Bot Scripts

This repository contains Node.js scripts to manage custom response keys in Dialogflow CX and to manage Firestore data using data from a Google Sheets file exported to XLSX format. The purpose of this project is to automate the process of updating Dialogflow CX and Firestore data based on information stored in a Google Sheets document.

## Requirements

To run the scripts in this repository, you'll need:
- Node.js installed on your machine
- Access to the Google Sheets document
- Access to the Firestore database
- ENV file containing the credentials from the Google Cloud service account

## Usage

### Import Data to Firestore
1. Export the Google Sheets document to XLSX format.
2. Place the exported XLSX file in the project folder.
3. Run the Node.js script to update the corresponding data in Firestore:

```
node import_dialogues.mjs
```

or

```
node import_objects.mjs
```

### Export Data from Firestore

1. Run the Node.js script to export data to an XLSX file:

```
node export_dialogues.mjs
```

### Firestore Operations

The `firestore.mjs` module provides a `main()` function to execute Firestore operations within that module. To utilize this functionality, follow these steps:

1. Within `firestore.mjs`, edit the `main()` function as you need and and uncomment it in the last line.
   
2. Run the following command in your terminal:

```
node firestore.mjs
```

Don't forget to comment out the `main()` function in the last line when you're done! :>
