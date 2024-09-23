const express = require('express');
const path = require('path');
const app = express();
const port = 3000;
 
// Serve static files from the 'tmp' folder inside the RGI_botkit_with_80D directory
app.use('/uploads', express.static(path.join(__dirname, 'tmp')));
 
// Route to handle file download (optional)
app.get('/file-download', (req, res) => {
    res.send('Link generated and logged in the terminal.');
});
 
// Start the server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
 
    // Generate the file download link after the server starts
    const fileName = 'batman.pdf'; // Replace with the actual filename
    const fileUrl = `http://localhost:${port}/uploads/${fileName}`;
    console.log(`Generated download link: ${fileUrl}`);
});
 