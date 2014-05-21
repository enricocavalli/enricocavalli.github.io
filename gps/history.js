var geojson={};

geojson.type="GeometryCollection";
geojson.geometries=[];

for (var p in pts) {
		position = new Object;
		position.type="Point";
		position.coordinates = [];
		position.coordinates.push(pts[p].coords.longitude);
		position.coordinates.push(pts[p].coords.latitude);
	geojson.geometries.push(position);
}

