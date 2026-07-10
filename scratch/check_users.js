async function checkUsers() {
  try {
    const res = await fetch("https://firestore.googleapis.com/v1/projects/gas-agency-mr/databases/(default)/documents/users?pageSize=1000");
    const json = await res.json();
    console.log("Found " + (json.documents || []).length + " user documents.");
    
    (json.documents || []).forEach(d => {
      const docId = d.name.split("/").pop();
      const fields = d.fields || {};
      const name = fields.name ? fields.name.stringValue : 'N/A';
      const email = fields.email ? fields.email.stringValue : 'N/A';
      const passwordHash = fields.passwordHash ? fields.passwordHash.stringValue : 'N/A';
      const passwordText = fields.passwordText ? fields.passwordText.stringValue : 'N/A';
      const status = fields.status ? fields.status.stringValue : 'N/A';
      console.log(`User ID: ${docId} | Name: ${name} | Email: ${email} | Hash: ${passwordHash} | PassText: ${passwordText} | Status: ${status}`);
    });
  } catch (e) {
    console.error(e);
  }
}

checkUsers();
