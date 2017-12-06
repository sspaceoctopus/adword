var URL_LEVEL = 'Ad'; // Ad or Keyword
var ONLY_ACTIVE = false; // set to false for all ads or keywords
var CAMPAIGN_LABEL = ''; // set this if you want to only check campaigns with this label
var STRIP_QUERY_STRING = true; // set this to false if the stuff that comes after the question mark is important
var WRAPPED_URLS = true; // set this to true if you use a 3rd party like Marin or Kenshoo for managing you account
// This is the specific text to search for 
// on the page that indicates the item 
// is out of stock.
var LABEL_NAMES = ['"test"'];

var keywords = {};

function getDataFromXml() {
    var xmlUrl = 'https://www.malva-parfume.ua/export/hotline.xml?from=adw-auto';
    try {
        var xml = UrlFetchApp.fetch(xmlUrl).getContentText();
        var document = XmlService.parse(xml);
    }
    catch(e) {
        Logger.log('There was an issue :' + e );
    }
    var entries = document.getRootElement().getChild("items");
    var orders = entries.getChildren('item');
    //Logger.log(orders.length+" items");
    var prices = {};
	for (var i = 0; i < orders.length; i++) {
		var url = cleanUrl(orders[i].getChildText('url'));
		var name = orders[i].getChildText('name');
		var price = parseFloat(orders[i].getChildText('priceRUAH').toString());
		var inStock = (orders[i].getChildText('stock') == 'В наличии');
		var newRow ={};
		if (prices[url]){
			newRow = { 
				'price' : price,
				'inStock' : inStock
			};
			prices[url][name] = newRow;
		}
		else{
			newRow[name] = { 
				'price' : price,
				'inStock' : inStock
			};
			prices[url] = newRow;
		}
    return prices
}

function setKeywordPrice(keyword, prices,adGroupName) {
    var keywordId = keyword.getId();
	if (keywords[keywordId]) {} else {
        for (var name in prices) {
			if(name == adGroupName){
				Logger.log('Keyword: '+keyword+', Price: '+ prices[name].price+', ad group: '+ adGroupName);
				keyword.setAdParam(1, prices[name].price);
				keywords[keywordId] = true;
			}
        }
    }
}

function setAdPrice(ad, prices) {
    var keywords = ad.getAdGroup().keywords().get();
	var adGroupName = ad.getName();
    while(keywords.hasNext()) {
        var keyword = keywords.next();
        setKeywordPrice(keyword, prices,adGroupName);
        //Logger.log('Ad: '+ad+'; Price: '+price+'; Keyword: '+keyword);
    }
}

function cleanUrl(url) {
    if(WRAPPED_URLS) {
        url = url.substr(url.lastIndexOf('http'));
        if(decodeURIComponent(url) !== url) {
            url = decodeURIComponent(url);
        }
    }
    if(STRIP_QUERY_STRING) {
        if(url.indexOf('?')>=0) {
            url = url.split('?')[0];
        }
    }
    if(url.indexOf('{') >= 0) {
        //Let's remove the value track parameters
        url = url.replace(/\{[0-9a-zA-Z]+\}/g,'');
    }
    return url;
}

function buildSelector(camp, url_level) {
    var selector = (url_level === 'Ad') ? camp.ads() : camp.keywords();
    return selector;
}

function main() {
    var alreadyCheckedUrls = {};
    var prices = getDataFromXml();
    var campIter = AdWordsApp.campaigns().get();
    while (campIter.hasNext()) {
        var camp = campIter.next();
        var adIter = buildSelector(camp, 'Ad');
        adIter = adIter.withCondition('LabelNames CONTAINS_ANY [' + LABEL_NAMES.join(',') + ']');
        adIter = adIter.get();
        //Logger.log(adIter.totalNumEntities());
        while(adIter.hasNext()) {
            var entity = adIter.next();
            var url = entity.urls().getFinalUrl();
            if (url === null)
                continue;
            url = cleanUrl(url);
            try {
                setAdPrice(entity, prices[url]);
                //Logger.log('Url: '+url+'; Price: '+prices[url]+'; Entity: '+entity);
            } 
            catch(e) {
                Logger.log('There was an issue setting:' + url + ' price , Skipping.');
                continue;
            }
            //Logger.log('Url: '+url+' price is '+prices[url]);

            if(alreadyCheckedUrls[url]) {
                if(alreadyCheckedUrls[url] === 'out of stock') {
                    entity.pause();
                    //keyword.pause();
                } else {
                    entity.enable();
                    //keyword.enable();
                }
            }
            else {
                if(prices[url]) {
                    alreadyCheckedUrls[url] = 'in stock';
                    entity.enable();
                } else {
                    alreadyCheckedUrls[url] = 'out of stock';
                    entity.pause();
                }
                //Logger.log('Url: '+url+' is '+alreadyCheckedUrls[url]+'; price: '+prices[url].price);
            }
        }
    }
}
