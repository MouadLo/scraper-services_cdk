const Squiss = require('squiss');
const AWS = require('aws-sdk');
var webdriver = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const { Builder, By, Key, until, Condition, WebElementCondition, WebDriver } = require('selenium-webdriver');
AWS.config.update({region:'us-east-1'});
const DocumentClient = new AWS.DynamoDB.DocumentClient();
const S3 = new AWS.S3();


(async function example() {
    // Configure the SQS queue to watch for jobs.
    if (process.env.QUEUE_URL == '') {
        
    }
    var workQueue = new Squiss({
        queueUrl: process.env.QUEUE_URL,
        bodyFormat: 'json',
        maxInFlight: 3
    });

    // What to do when a job pops up on the queue.
    workQueue.on('message', async function (msg) { 
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
        let pageTitle;
        let product = {};
        try {
            // 
            await driver.get(msg.body.uri); 
            uri = msg.body.uri;
            await driver.wait(until.elementLocated(By.className('next-dialog-close')), 100000);
            await driver.findElement(By.className('next-dialog-close')).click()

            pageTitle = await (await driver).getTitle();
            console.log(pageTitle)
            
            product['pageTitle'] = pageTitle;

            // wait for the page to load the product page
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

                // Get the length of SKU info to check if there any attribute to scrape
                const  div_length = await sku_property[i].findElements(By.tagName('div'))
                console.log(div_length.length);
                if (div_length.length > 1) {
                    // get the sku property
                   let property_list = await sku_property[i].findElement(By.className('sku-property-list'))
                    let li_property_items = await property_list.findElements(By.tagName('li'))
                    
                    let li_arr_property_items = [];
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
                                li_arr_property_items.push(property_text);
                            } else if (li_property_item_class == 'sku-property-image') {
                                let property = await li_property_item.findElement(By.tagName('img'));
                                let property_attr = await property.getAttribute('title');
                                console.log(property_attr)
                                li_arr_property_items.push(property_attr);
                            }
                        }
                    }
                    product[`${sku_title_text}`] = li_arr_property_items;
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

            // specs_list = await driver.findElement(By.className('product-specs'));
            // li_specs_list = await specs_list.findElements(By.tagName('li'));
            // for (let k; k < li_specs_lis.length; k++){
            //     let property_title = li_specs_lis[k].findElement(By.className('property-title'));
            //     let property_title_txt = await property_title.getText();

            //     let property_desc = li_specs_lis[k].findElement(By.className('property-desc'));
            //     let property_desc_txt = await property_desc.getText();


            //     console.log(`property_title : ${property_title_txt} property_desc : ${property_desc_txt}`)
            // }

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
            UpdateExpression: 'SET #s = :s, #u = :u,#pt = :pt',
            ExpressionAttributeNames: {
                '#s': 'status',
                '#u': 'uri',
                '#pt': 'pageInfo'
            },
            ExpressionAttributeValues: {
                ':s': 'done',
                ':u': uri,
                ':pt': JSON.stringify(product)
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
  