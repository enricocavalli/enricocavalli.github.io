var currPosition;

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


navigator.geolocation.getCurrentPosition(function(position) {
    updatePosition(position);
    setInterval(function(){
        var lat = currPosition.coords.latitude;
        var lng = currPosition.coords.longitude;
        console.log(JSON.stringify(position));
        /*
        jQuery.ajax({
            type: "GET", 
            url:  "http://cici.cilea.it/", 
            data: JSON.stringify(position), 
            cache: false
        });
     */
 	},  2000);
}, errorCallback); 

//var watchID = navigator.geolocation.watchPosition(function(position) {
  //  updatePosition(position);
//}); 
