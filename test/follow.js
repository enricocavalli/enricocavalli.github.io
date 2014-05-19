var currPosition;

var pts = [];               // All the GPS points
var distIndex = 1;          // Index for distance calculation
var totalDistance = 0.0;    // Total distance travelled
var currentLat = 0.0;       // Current latitude
var currentLng = 0.0;       // Current longitude
var accuracy = 0.0;         // Current accuracy in miles
var minDistance = 0.05;     // Minimum distance (miles) between collected points.


function distance (lat1,lng1,lat2,lng2)
{
var radius = 6371; // km
  var deltaLat = ToRadians(lat2 - lat1);
   var deltaLng = ToRadians(lng2 - lng1);
   var sinLat = Math.sin(0.5*deltaLat);
   var sinLng = Math.sin(0.5*deltaLng);
   var cosLat1 = Math.cos(ToRadians(lat1));
   var cosLat2 = Math.cos(ToRadians(lat2));
   var h1 = sinLat*sinLat + cosLat1*cosLat2*sinLng*sinLng;
   var h2 = Math.sqrt(h1);
   var h3 = 2*Math.asin(Math.min(1, h2));
   var distance = radius * h3;

   return distance;
}

function ToRadians(degree) {
   return (degree * (Math.PI / 180));
}

var options = {
  enableHighAccuracy: true,
  timeout: 5000,
  maximumAge: 0
};

function updatePosition( position ){

    if(position.coords.accuracy/500 > 0.5) {  // 500mt
      alert('not enough accuracy');
        return;
    }
    var dist = distance(currentLat,currentLng,position.coords.latitude, position.coords.longitude);

    if (dist < minDistance) {
        alert('dist: '+dist);
        return;
    }
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

        
        console.log(JSON.stringify(pos));
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
