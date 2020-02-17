 
const AWS = require('aws-sdk');
AWS.config.update({region:'us-east-1'});
const DocumentClient = new AWS.DynamoDB;

(async function example() {
    const params = {
        TableName: 'base-resource-table8235A42E-GMJVL5881L01',
      };
    
      try {
        const result = await DocumentClient.scan(params).promise();
        // Return the matching list of items in response body
        console.log(result.Items);
      } catch (e) {
        console.error(e);
      }
})();
  