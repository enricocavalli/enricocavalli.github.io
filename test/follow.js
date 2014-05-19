var currPosition;

var options = {
  enableHighAccuracy: true,
  timeout: 5000,
  maximumAge: 0
};

function updatePosition( position ){
    currPosition = position;
}

function errorCallback(error) {
    var msg = "Can't get your location. Error = ";
    if (error.code == 1)
        msg += "PERMISSION_DENIED";
    else if (error.code == 2)
        msg += "POSITION_UNAVAILABLE";
    else if (error.code == 3)
        msg += "TIMEOUT";
    msg += ", msg = "+error.message;

    alert(msg);
}

setInterval(function() {
	navigator.geolocation.getCurrentPosition(function(position) {
        console.log(JSON.stringify(position));
        /*
        jQuery.ajax({
            type: "GET", 
            url:  "http://cici.cilea.it/", 
            data: JSON.stringify(position), 
            cache: false
        });
     */
 	} , errorCallback,options)
},7000);

//var watchID = navigator.geolocation.watchPosition(function(position) {
  //  updatePosition(position);
//}); 
