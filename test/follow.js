options = {
  enableHighAccuracy: true,
  timeout: 5000,
  maximumAge: 0
};

function success(pos) {
  var crd = pos.coords;
  var currentdate = new Date();
    console.log(currentdate+': '+crd.latitude+' '+crd.longitude);
    console.log(JSON.stringify(pos));
};

function error(err) {
  console.warn('ERROR(' + err.code + '): ' + err.message);
};

navigator.geolocation.watchPosition(success, error, options)