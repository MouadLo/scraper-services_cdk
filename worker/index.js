const Squiss = require('squiss');
const AWS = require('aws-sdk');
var webdriver = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const {Builder, By, Key, until,Condition,WebElementCondition,WebDriver } = require('selenium-webdriver');
const DocumentClient = new AWS.DynamoDB.DocumentClient();
const S3 = new AWS.S3();


(async function example() {
    // Configure the SQS queue to watch for jobs.
    var workQueue = new Squiss({
        queueUrl: process.env.QUEUE_URL,
        bodyFormat: 'json',
        maxInFlight: 3
    });
    var chromeCapabilities = webdriver.Capabilities.chrome();
    // Disable sandbox, its preferable to granting CAP_SYS_ADMIN to enable sandbox   
    // Fargate tasks have their own isolation model anyway.
    // Use local /tmp instead of shared memory

    let chromeOptions = new chrome.Options();
    chromeOptions.addArguments(['--test-type', '--headless', '--no-sandbox', '--disable-dev-shm-usage'])
    //chromeOptions2.args = ['--test-type', '--headless', '--no-sandbox', '--disable-dev-shm-usage']
    let driver = new Builder()
        .forBrowser('chrome')
        .setChromeOptions(chromeOptions)
        .build();
    // What to do when a job pops up on the queue.
    workQueue.on('message', async function (msg) { 
        console.log(`Job ${msg.body.id}, rendering ${msg.body.uri}`);  

        // Update the status to started
        await DocumentClient.update({
            TableName: process.env.TABLE,
            Key: { id: msg.body.id },
            UpdateExpression: 'SET #s = :s',
            ExpressionAttributeNames: {
            '#s': 'status'
            },
            ExpressionAttributeValues: {
            ':s': 'started'
            }
        }).promise();

        let uri;
        try {
            await driver.get(msg.body.uri);
            
            await driver.wait(until.elementLocated(By.xpath('/html/body/div[10]/div[2]/div/a')), 100000);
            await driver.findElement(By.xpath('/html/body/div[10]/div[2]/div/a')).click()
            let pageTitle = await (await driver).getTitle();
            console.log(pageTitle)
    
            await driver.wait(until.elementLocated(By.xpath('//*[@id="root"]/div/div[2]/div/div[2]/div[7]/div')));
    
            sku_wrap = await driver.findElement(By.xpath('//*[@id="root"]/div/div[2]/div/div[2]/div[7]/div'))
            sku_property = await sku_wrap.findElements(By.className('sku-property'))
            console.log(sku_property)
            console.log(sku_property.length);
    
            for (let i = 0; i < sku_property.length; i++){
                // Get the SKU info title
                let sku_title = await sku_property[i].findElement(By.className('sku-title'));
                let sku_title_text = await (await sku_title).getText();
                console.log(sku_title_text);
    
                // Get the length of SKU info to check if there any attribute
                const  div_length = await sku_property[i].findElements(By.tagName('div'))
                console.log(div_length.length);
                if (div_length.length > 1) {
                   let property_list = await sku_property[i].findElement(By.className('sku-property-list'))
                   let li_property_items = await property_list.findElements(By.tagName('li'))
                    console.log(li_property_items.length);
                    for (let j = 0; j < li_property_items.length; j++){
                       let li_property_items_class = await li_property_items[j].getAttribute('class');
                        if (li_property_items_class == 'sku-property-item' || li_property_items_class == 'sku-property-item selected') {
                          let  li_property_item = await li_property_items[j].findElement(By.tagName('div'))
                          let li_property_item_class = await li_property_item.getAttribute('class')
                            if (li_property_item_class == 'sku-property-text') {
                                let property = await li_property_item.findElement(By.tagName('span'))
                                let property_text = await (await property).getText();
                                console.log(property_text)
                            } else if (li_property_item_class == 'sku-property-image') {
                                let property = await li_property_item.findElement(By.tagName('img'));
                                let property_attr = await property.getAttribute('title');
                                console.log(property_attr)
                            }
                        }
                    }
                }
    
            }  
            
            elem = await driver.findElement(By.className('images-view-list'))
            li_elem = await elem.findElements(By.tagName('li'));
            console.log(li_elem.length);
            for (let k = 0; k < li_elem.length; k++){
                let img = await li_elem[k].findElement(By.tagName('img'));
                let imgUrl = await img.getAttribute('src');
                console.log(imgUrl.split('_')[0]);
            }
    
        } catch(e) {
            console.error(e);
                // Update job status to failed
            await DocumentClient.update({
                TableName: process.env.TABLE,
                Key: { id: msg.body.id },
                UpdateExpression: 'SET #s = :s, #r = :r',
                ExpressionAttributeNames: {
                '#s': 'status',
                '#r': 'reason'
                },
                ExpressionAttributeValues: {
                ':s': 'failed',
                ':r': e.toString()
                }
            }).promise();
    
            return msg.del();
        
        }finally {
            await driver.quit();
        }
        // Update job status to done
        await DocumentClient.update({
            TableName: process.env.TABLE,
            Key: { id: msg.body.id },
            UpdateExpression: 'SET #s = :s, #u = :u',
            ExpressionAttributeNames: {
            '#s': 'status',
            '#u': 'uri'
            },
            ExpressionAttributeValues: {
            ':s': 'done',
            ':u': uri
            }
        }).promise();

        console.log(`Done with job ${msg.body.id}`);
        msg.del();
    });
    // This handler executes when the process is told to shutdown,
    // this happens when ECS stops a task and docker sends SIGTERM to
    // the container.
    process.on('SIGTERM', function() {
        console.log('Shutting down');
    
        // Stop listening for new jobs off the queue.
        workQueue.stop();
    });
    
    // Let's get started!
    workQueue.start();
    console.log('Started listening for work');
})();
  