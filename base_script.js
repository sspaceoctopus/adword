var URL_LEVEL = 'Ad'; // Ad or Keyword
var ONLY_ACTIVE = false; // set to false for all ads or keywords
var CAMPAIGN_LABEL = ''; // set this if you want to only check campaigns with this label
var STRIP_QUERY_STRING = true; // set this to false if the stuff that comes after the question mark is important
var WRAPPED_URLS = true; // set this to true if you use a 3rd party like Marin or Kenshoo for managing you account
// This is the specific text to search for 
// on the page that indicates the item 
// is out of stock.
var LABEL_NAMES = ['"test"'];
var OUT_OF_STOCK_TEXT = 'Нет в наличии';
var PRICE_TEXT_BEGIN = '<span class="price-oth">';
var PRICE_TEXT_END = ' грн</span>';
var keywords = {};
 
function setKeywordPrice(keyword, price) {
    var keywordId = keyword.getId();
    if (keywords[keywordId]) {} else {
        Logger.log('Keyword: '+keyword+', Price: '+price);
        keyword.setAdParam(1, price);
        keywords[keywordId] = true;
    }
}

function setAdPrice(ad, price) {
    var keywords = ad.getAdGroup().keywords().get();
    while(keywords.hasNext()) {
        var keyword = keywords.next();
        setKeywordPrice(keyword, price);
        //Logger.log('Ad: '+ad+'; Price: '+price+'; Keyword: '+keyword);
    }
}

function main() {
    var alreadyCheckedUrls = {};
    var prices = {};
    var campIter = AdWordsApp.campaigns().get();
    while (campIter.hasNext()) {
        var camp = campIter.next();
        var adIter = buildSelector(camp, 'Ad');
        adIter = adIter.withCondition('LabelNames CONTAINS_ANY [' + LABEL_NAMES.join(',') + ']');
        adIter = adIter.get();
        //Logger.log(iter.totalNumEntities());
        while(adIter.hasNext()) {
            var entity = adIter.next();
            var url = entity.urls().getFinalUrl();
            if (url === null)
                continue;
            url = cleanUrl(url);
            if (prices[url]) {
                setAdPrice(entity, prices[url]);
                //Logger.log('Url: '+url+'; Price: '+prices[url]+'; Entity: '+entity);
            }
            else {
                var htmlCode;
                try {
                    htmlCode = UrlFetchApp.fetch(url).getContentText();
                } catch(e) {
                    Logger.log('There was an issue checking:'+url+', Skipping.');
                    continue;
                }
                var priceStart = htmlCode.indexOf(PRICE_TEXT_BEGIN) + PRICE_TEXT_BEGIN.length;
                if(priceStart >= 0) {
                    var priceEnd = htmlCode.indexOf(PRICE_TEXT_END, priceStart);
                    prices[url] = htmlCode.substr(priceStart, priceEnd - priceStart).replace(/\D/, '');
                    //setKeywordPrice(keyword, prices[url]);
                    setAdPrice(entity, prices[url]);
                    //Logger.log('Url: '+url+'; Price: '+prices[url]+'; Entity: '+entity);
                }
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
                var htmlCode;
                try {
                    htmlCode = UrlFetchApp.fetch(url).getContentText();
                } catch(e) {
                  Logger.log('There was an issue checking:'+url+', Skipping.');
                  continue;
                }
                if(htmlCode.indexOf(OUT_OF_STOCK_TEXT) >= 0) {
                  alreadyCheckedUrls[url] = 'out of stock';
                  entity.pause();
                } else {
                  alreadyCheckedUrls[url] = 'in stock';
                  entity.enable();
                }
                Logger.log('Url: '+url+' is '+alreadyCheckedUrls[url]+'; price: '+prices[url]);
            }
        }
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