const https = require('https');
const fs = require('fs');
const express = require('express');
const app = express();
const axios = require('axios');
const path = require('path');
const sdk = require("./lib/sdk");

var Promise = sdk.Promise;
var port1 = 3000;
var counterFor80D = 0;
var counterForNCB = 0;
var countTest = 0;
let base64file; // Global variable to store the upload response
let flag = false;
var output = "";

// Function to convert a file to Base64
function fileToBase64(filePath) {
    return new Promise((resolve, reject) => {
        fs.readFile(filePath, (err, bufferdata) => {
            if (err) {
                reject(err);
            } else {
                var base64String = bufferdata.toString('base64');
                base64file = base64String;
                resolve(base64String);
            }
        });
    });
}

// Function to convert Base64 string to PDF
function base64ToPdf(base64String, outputFilePath) {
    return new Promise((resolve, reject) => {
        const binaryData = Buffer.from(base64String, 'base64');
        fs.writeFile(outputFilePath, binaryData, (err) => {
            if (err) {
                console.error('Error writing file:', err);
                reject(err);
            } else {
                console.log('PDF file created successfully!');
                resolve();
            }
        });
    });
}

// Serve static files from the uploads folder
app.use('/uploads', express.static('uploads'));

// Configure multer for file storage (if needed, otherwise this can be removed)
app.get('/file-download', (req, res) => {
    const fileName = '123.pdf'; // Replace with the actual filename you want to generate the download link for
    const fileLocation = path.join(__dirname, 'uploads', fileName);
    const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${fileName}`;
    res.send({ fileUrl });
});

// Start the server
app.listen(port1, () => {
    console.log(`Server running at http://localhost:${port1}`);
});

// Function to perform GET request
async function get80DCard(policyNo, mobileNumber, email) {
    const url = `http://dailydiary.brobotinsurance.com/UserService.svc/Get80DCard/${policyNo}/${mobileNumber}/${email}`;

    try {
        const response = await axios.get(url);
        // Check if the request was successful
        output = response.data;
        return response.data;
    } catch (error) {
        console.error('There was a problem with the fetch operation:', error);
    }
}

// Function to download file
const downloadFile = async (fileName, fileUrl, destination) => {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(path.join(destination, fileName));
        const options = {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.36',
            }
        };
        const request = https.get(fileUrl, options, response => {
            if (response.statusCode === 200) {
                let fileSize = 0;
                response.on('data', chunk => {
                    fileSize += chunk.length;
                    if (fileSize > 25 * 1024 * 1024) {
                        console.error('File size exceeds 25 MB limit');
                        fs.unlink(path.join(destination, fileName), () => {});
                        reject(new Error('File size exceeds 25 MB limit'));
                    }
                });

                response.pipe(file);
                file.on('finish', () => {
                    file.close(() => {
                        console.log('File downloaded successfully.');
                        resolve(path.join(destination, fileName));
                    });
                });
            } else {
                console.error('Failed to download file. Status code:', response.statusCode);
                fs.unlink(path.join(destination, fileName), () => {});
                reject(new Error('Failed to download file. Status code:' + response.statusCode));
            }
        });

        request.on('error', error => {
            console.error('Error downloading file:', error);
            fs.unlink(path.join(destination, fileName), () => {});
            reject(error);
        });
    });
};

module.exports = {
    botId: "st-ebda08ba-61f8-5eed-894a-9fd516a252cc",
    botName: "RGI NLP Bot",
    on_user_message: async function(requestId, data, callback) {
        if (!data.context.session.BotUserSession.entities) {
            data.context.session.BotUserSession.entities = {};
        }
        console.log("On user message count: ", ++countTest);
        console.log("user session", JSON.stringify(data.context.session.UserSession));

        Object.assign(data.context.session.BotUserSession.entities, data.context.entities);

        if (data?.channel?.attachments?.[0]) {
            console.log("ON USER MESSAGE in email condition", "file attachment", data?.channel?.attachments?.[0].url?.fileUrl);

            const fileUrl = data?.channel?.attachments?.[0].url?.fileUrl;
            const fileName = data?.channel?.attachments?.[0]?.fileName;
            const destinationDirectory = './tmp';

            const filePath = await downloadFile(fileName, fileUrl, destinationDirectory); // Await the download
            await fileToBase64(filePath); // Convert to Base64

            data.context.session.BotUserSession.base64file = base64file;
            data.context.session.BotUserSession.fileName = fileName;
        }
        return sdk.sendBotMessage(data, callback);
    },

    on_bot_message: async function(requestId, data, callback) {
        console.log("On bot message count: ", ++countTest);

        Object.assign(data.context.session.BotUserSession.entities, data.context.entities);

        if (data.context.session.BotUserSession.var === 1) {
            counterFor80D++;
            console.log(counterFor80D);
            if (counterFor80D === 1) {
                console.log("80D");
                const policyNo = data.context.session.BotUserSession.entities.ConfirmPN || data.context.entities.ConfirmPN;
                const mobileNumber = data.context.session.BotUserSession.entities.Phone_Number || data.context.entities.Phone_Number;
                const email = data.context.session.BotUserSession.entities.email__id || data.context.entities.email__id;

                await get80DCard(policyNo, mobileNumber, email);

                const base64String = output;
                //console.log("done", base64String);

                function generateUniqueNumber() {
                    const timestamp = Date.now();
                    const randomNum = Math.floor(Math.random() * 10000);
                    const uniqueNumber = timestamp + randomNum;
                    return uniqueNumber;
                }

                const uniquesNumber = generateUniqueNumber();
                const outputFilePath = `./uploads/${uniquesNumber}.pdf`;
                const generatedFileUrlNow = `https://github.com/HoonartekSDK/RGIBotkitSDK/blob/main/uploads/${uniquesNumber}.pdf`;
                data.context.session.BotUserSession.entities.generatedFileLink = generatedFileUrlNow;

                if (base64String) {
                    try {
                        await base64ToPdf(base64String, outputFilePath);
                        data.context.session.BotUserSession.var = 0;
                        console.log('File saved as:', outputFilePath);
                    } catch (err) {
                        console.error('File creation failed.');
                    }
                }
            }
        }

        if (data.context.session.BotUserSession.NCBFlow === 1) {
            counterForNCB++;
            console.log(counterForNCB);
            if(counterForNCB===1)
            {
                console.log("NCB");
                var data1 = {};
                const token = data.context.session.BotUserSession.NCBToken;
                const policyNo = data.context.session.BotUserSession.entities.EnterPolicyNo || data.context.entities.EnterPolicyNo;
                const mobileNumber = data.context.session.BotUserSession.entities.PhoneNumber || data.context.entities.PhoneNumber;

                const url = 'https://claimservices.brobotinsurance.com/NCBWrapperAPI/api/NCBWrapperAPI/GetNCBDocuments';
                const config = {
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`,
                    }
                };
                if (policyNo) {
                    data1 = {
                        "LetterType": "ConfirmationLetter",
                        "SearchBy": "PolicyNo",
                        "SearchValue": policyNo,
                        "SearchValue2": ""
                    };
                } else if (mobileNumber) {
                    data1 = {
                        "LetterType": "ConfirmationLetter",
                        "SearchBy": "mobileNumber",
                        "SearchValue": mobileNumber,
                        "SearchValue2": ""
                    };
                } else {
                    console.log("data not found");
                }

                try {
                    const response = await axios.post(url, data1, config);
                    output = response.data.fileBytes;
                    //console.log('Response:', response.data);
                } catch (error) {
                    console.error('Error:', error);
                }
                function generateUniqueNumber() {
                    const timestamp = Date.now();
                    const randomNum = Math.floor(Math.random() * 10000);
                    const uniqueNumber = timestamp + randomNum;
                    return uniqueNumber;
                }

                const uniquesNumber = generateUniqueNumber();
                const outputFilePath = `./uploads/${uniquesNumber}.pdf`;
                const generatedFileUrlNow = `https://github.com/HoonartekSDK/RGIBotkitSDK/blob/main/uploads/${uniquesNumber}.pdf`;
                data.context.session.BotUserSession.entities.generatedFileLink = generatedFileUrlNow;
                const base64String = output;
                if (base64String) {
                    data.context.session.BotUserSession.NCBFlow = undefined;
                    try {
                        await base64ToPdf(base64String, outputFilePath);
                        console.log('File saved as:', outputFilePath);
                    } catch (err) {
                        console.error('File creation failed.');
                    }
                }
            }
        }

        if (data?.context?.currentNodeName == "AcknowledgementMessage0003") {
            sdk.sendUserMessage(data, callback);
            return sdk.closeConversationSession(data, callback);
        }

        return sdk.sendUserMessage(data, callback);
    },

    on_webhook: function(requestId, data, callback) {
        console.log("On event message count: ", ++countTest);
        console.log("on_event -->  Event : ", data.event);
        console.log("data in webhook <<<", data);

        if (data.componentName == 'CloseSession') {
            console.log("closing session");
            return sdk.closeConversationSession(data, callback);
        }

        return sdk.sendUserMessage(data, callback);
    },

    on_event: function(requestId, data, callback) {
        Object.assign(data.context.session.BotUserSession.entities, data.context.entities);
        console.log("on_event -->  Event : ", data.event);
        return callback(null, data);
    },

    on_alert: function(requestId, data, callback) {
        console.log("on_alert -->  : ", data, data.message);
        return sdk.sendAlertMessage(data, callback);
    }
};
