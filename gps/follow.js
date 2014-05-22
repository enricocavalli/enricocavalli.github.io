var currPosition;

var localStorageKey="io.github.enricocavalli.gps";
var pts = JSON.parse(localStorage.getItem(localStorageKey)) || [] ;

var distIndex = 1;          // Index for distance calculation
var totalDistance = 0.0;    // Total distance travelled
var currentLat = 0.0;       // Current latitude
var currentLng = 0.0;       // Current longitude
var accuracy = 0.0;         // Current accuracy in km
var minDistance = 0.05;     // Minimum distance (km) between collected points.

var now = Date.now();

for (var p in pts) {
    
    var diff = (now - pts[p].timestamp) /1000 - 978303600;
    console.log(now+' '+pts[p].timestamp+' '+diff);
}

function distance (lat1,lon1,lat2,lon2)
{
var R = 6371; // km
var x1 = lat2-lat1;
var dLat = x1.toRad();  
var x2 = lon2-lon1;
var dLon = x2.toRad();  
var a = Math.sin(dLat/2) * Math.sin(dLat/2) + 
                Math.cos(lat1.toRad()) * Math.cos(lat2.toRad()) * 
                Math.sin(dLon/2) * Math.sin(dLon/2);  
var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
var d = R * c; 

   return d;
}

Number.prototype.toRad = function() {
   return this * Math.PI / 180;
}

var options = {
  enableHighAccuracy: true,
  timeout: 5000,
  maximumAge: 0
};

function updatePosition( position ){

    if(position.coords.accuracy/500 > 0.5) {  // 500mt
        return;
    }
    var dist = distance(currentLat,currentLng,position.coords.latitude, position.coords.longitude);

    if (dist < minDistance) {
        return;
    }
    console.log(position);
    pts.push(position);
    accuracy=position.coords.accuracy/500;
    currentLat=position.coords.latitude;
    currentLng=position.coords.longitude;
    var pos = new Object();
    pos.coords = new Object();
    pos.timestamp = position.timestamp;

        for (var name in position.coords ) {
            pos.coords[name]=position.coords[name];
        }

    localStorage.setItem(localStorageKey, JSON.stringify(pts));
       // console.log(JSON.stringify(pos));
        jQuery.ajax({
            type: "POST", 
            url:  "http://cici.cilea.it/log.php", 
            data: JSON.stringify(pos), 
            cache: false,
            contentType: 'application/json',        
            dataType: 'json'
        });
}

function errorCallback(error) {
    var msg = "Can't get your location. Error = ";
    if (error.code == 1) {
        msg += "PERMISSION_DENIED";
        alert(msg);
    }

    if (error.code == 2)
        msg += "POSITION_UNAVAILABLE";
    else if (error.code == 3)
        msg += "TIMEOUT";
    msg += ", msg = "+error.message;

    console.warn(msg);
}

var watchID = navigator.geolocation.watchPosition(function(position) {
    updatePosition(position);
},errorCallback,options); 
