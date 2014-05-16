var map = L.map('map');
var popup = L.popup();

// add an OpenStreetMap tile layer
L.tileLayer('http://{s}.tile.osm.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

map.locate({setView: true, maxZoom: 16});

function onLocationFound(e) {
    var radius = e.accuracy / 2;

    L.marker(e.latlng).addTo(map)
        .bindPopup(e.latlng.toString() + ", " + "Accuracy: " + radius + " meters");

    L.circle(e.latlng, radius).addTo(map);
}

map.on('locationfound', onLocationFound);

function onMapClick(e) {
    popup
        .setLatLng(e.latlng)
        .setContent(e.latlng.toString())
        .openOn(map);
}
map.on('click', onMapClick);

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
