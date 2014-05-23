var currPosition;

var localStorageKey="io.github.enricocavalli.gps";
var pts = JSON.parse(localStorage.getItem(localStorageKey)) || [] ;

var distIndex = 1;          // Index for distance calculation
var totalDistance = 0.0;    // Total distance travelled
var currentLat = 0.0;       // Current latitude
var currentLng = 0.0;       // Current longitude
var accuracy = 0.0;         // Current accuracy in km
var minDistance = 0.05;     // Minimum distance (km) between collected points.

if (pts.length > 2) { //uso l'ultimo timestamp come riferimento temporale

    var lastTimestamp = pts[pts.length-1].timestamp;
    var deleteIndex=[];

    for (var p in pts) {
        var diff = (lastTimestamp - pts[p].timestamp) /1000; 
            if (diff > 86400 ) {
                // prendo nota degli indici dei timestamp vecchi
                deleteIndex.push(p);
            }    
    }
    // elimino i timestamp vecchi
    for (var i = deleteIndex.length - 1; i>=0 ; i--) {
        pts.splice(deleteIndex[i],1);
    }
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

Number.prototype.toRad = function() 
{
   return this * Math.PI / 180;
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
    },errorCallback,{
  enableHighAccuracy: true,
  timeout: 5000,
  maximumAge: 0
}); 

function updatePosition( position ){

    if(position.coords.accuracy/500 > 0.5) {  // 500mt
        return;
    }
    var dist = distance(currentLat,currentLng,position.coords.latitude, position.coords.longitude);

    if (dist < minDistance) {
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
    localStorage.setItem(localStorageKey, JSON.stringify(pts));
       /*
        jQuery.ajax({
            type: "POST", 
            url:  "http://cici.cilea.it/log.php", 
            data: JSON.stringify(pos), 
            cache: false,
            contentType: 'application/json',        
            dataType: 'json'
        });
        */
}

var osmUrl='http://otile{s}.mqcdn.com/tiles/1.0.0/map/{z}/{x}/{y}.jpeg';
var osmAttrib='Map data © <a href="http://osm.org/copyright">OpenStreetMap</a> contributors';
var subDomains = '1234';
var osm = new L.TileLayer(osmUrl, {
        attribution: osmAttrib,
        subdomains: subDomains
});

var historyToggle=false;
var markers= L.featureGroup();

var info = L.control();
info.added = false;
info.onAdd = function (map) {
    this._div = L.DomUtil.create('div', 'info'); // create a div with a class "info"
    this.update();
    return this._div;
};

info.update = function (props) {
 this._div.innerHTML = '<h4>Info</h4>' + 
 (props ? 'Center: '+props.center+'<br>'+'Box: '+props.box : '');

}
var map = new L.Map('map', {
    layers: [osm],
    center: [45.471, 9.178],
    zoom: 16,
	zoomControl: true
});

function coordToString(c,p) {
    p = typeof p !== 'undefined' ? p : 3;
    return c.lat.toFixed(p)+', '+c.lng.toFixed(p)
}

function showHistory() {
if (historyToggle ) {
    historyToggle=false;
    map.removeLayer(markers);
} else {
    historyToggle=true;
lc.stopFollowing();

for (var p in pts) {
  // if (pts[p].coords.latitude !== null && pts[p].coords.longitude !== null ) 
   markers.addLayer(L.marker([pts[p].coords["latitude"],pts[p].coords["longitude"]]));
}

 map.addLayer(markers);
// map.fitBounds(markers.getBounds());

  }
}

function displayBoundInformation() {
 var bounds=map.getBounds();
    var minll=bounds.getSouthWest();
    var maxll=bounds.getNorthEast();
    var center=map.getCenter();
    var o = Object;
    o.box= coordToString(minll)+' '+coordToString(maxll);  
    o.center = coordToString(center);
    info.update(o);

}
map.on('locationfound', function(e) { 
  if ( ! info.added ) {
    info.addTo(map);
    info.added=true;
    $(".info").click( showHistory );
    }
    displayBoundInformation();
    map.on('move', displayBoundInformation);
});

// add location control to global name space for testing only
// on a production site, omit the "lc = "!
lc = L.control.locate({
	follow: true,
	keepCurrentZoomLevel: true,
	onLocationError: function(err) { },
}).addTo(map);

map.on('startfollowing', function() {
    map.on('dragstart', lc.stopFollowing);
}).on('stopfollowing', function() {
    map.off('dragstart', lc.stopFollowing);
});

lc.locate();
