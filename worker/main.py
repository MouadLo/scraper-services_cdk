from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.wait import WebDriverWait

chrome_options = webdriver.ChromeOptions()
chrome_options.add_argument('--headless')
chrome_options.add_argument('--no-sandbox')
chrome_options.add_argument('--disable-dev-shm-usage')

browser = webdriver.Chrome('/usr/local/bin/chromedriver',options=chrome_options)

browser.get('https://www.aliexpress.com/item/32831776215.html?spm=a2g0o.tm75976.5776889310.9.61c91023ecejoZ&&scm=1007.25281.150765.0&scm_id=1007.25281.150765.0&scm-url=1007.25281.150765.0&pvid=f7c9e3ad-248b-460d-bab4-0ef0689cff97')

# Close the popup coupon
WebDriverWait(browser, 20).until(EC.element_to_be_clickable((By.XPATH, '/html/body/div[11]/div[2]/div/a'))).click()

print(browser.title) # Title of the page

sku_wrap = browser.find_element_by_xpath('//*[@id="root"]/div/div[2]/div/div[2]/div[7]/div')
sku_property = sku_wrap.find_elements_by_class_name('sku-property')
print(len(sku_property))
for div in sku_property:
    print(div.find_element_by_class_name('sku-title').text)
    if len(div.find_elements_by_tag_name('div')) > 1:
        property_list = div.find_element_by_class_name('sku-property-list')
        li_property_items = property_list.find_elements_by_tag_name("li")
        print(len(li_property_items))
        for li_property_item in li_property_items:
            if li_property_item.get_attribute('class') == 'sku-property-item':
                class_type = li_property_item.find_element_by_tag_name('div')
                if class_type.get_attribute('class') == 'sku-property-text':
                    sku_property = class_type.find_element_by_tag_name('span').text
                    print(sku_property)
                elif class_type.get_attribute('class') == 'sku-property-image':
                    sku_property = class_type.find_element_by_tag_name('img').get_attribute('title')
                    print(sku_property)
            else:
                continue


elem = browser.find_element_by_class_name('images-view-list')
all_li_images = elem.find_elements_by_tag_name("li")
for li in all_li_images:
    imageUrl = li.find_element_by_tag_name('img').get_attribute('src').split('_')
    print("Product Image URL: " + imageUrl[0])