var map = L.map('map');


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



// add an OpenStreetMap tile layer
//L.tileLayer('http://{s}.tile.osm.org/{z}/{x}/{y}.png', {
L.tileLayer('http://otile{s}.mqcdn.com/tiles/1.0.0/map/{z}/{x}/{y}.jpeg', {
    subdomains: '1234',
    attribution: 'Tiles by <a href="http://www.mapquest.com/">MapQuest</a> &mdash; Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, <a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>'
}).addTo(map);

map.locate({setView: true, maxZoom: 16});

function onLocationFound(e) {
    alert ('accuracy: '+ e.accuracy/2);
    var radius = e.accuracy / 2;

    L.marker(e.latlng).addTo(map)
        .bindPopup(e.latlng.toString() + ", " + "Accuracy: " + radius + " meters");

    L.circle(e.latlng, radius).addTo(map);
    if ( ! info.added ) {
    info.addTo(map);
    info.added=true;
    }
    displayBoundInformation();

    map.on('move',displayBoundInformation)
}

map.on('locationfound', onLocationFound);

/*
function onMapClick(e) {
    popup
        .setLatLng(e.latlng)
        .setContent(e.latlng.toString())
        .openOn(map);
}
map.on('click', onMapClick);
*/

function onEachFeature(feature, layer) {
    // does this feature have a property named popupContent?
    if (feature.properties && feature.properties.popupContent) {
        layer.bindPopup(feature.properties.popupContent);
    }
}

/*
var geojsonFeatures = [ {
    "type": "Feature",
    "properties": {
        "name": "Coors Field",
        "amenity": "Baseball Stadium",
        "popupContent": "uno"
    },
    "geometry": {
        "type": "Point",
        "coordinates": [9.293, 45.487]
    }
},
{
    "type": "Feature",
    "properties": {
        "name": "Coors Field",
        "amenity": "Baseball Stadium",
        "popupContent": "due"
    },
    "geometry": {
        "type": "Point",
        "coordinates": [9.301, 45.481]
    }
},
];


var myLayer = L.geoJson( geojsonFeatures, {onEachFeature: onEachFeature }).addTo(map);
*/

function coordToString(c,p) {
    p = typeof p !== 'undefined' ? p : 3;
    return c.lat.toFixed(p)+', '+c.lng.toFixed(p)
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

setTimeout(function() { map.locate({setView: false}); },5000);
