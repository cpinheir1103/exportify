// server.js
// where your node app starts

// init project
var http=require('http');
var url = require('url')
var express = require('express');
var app = express();
const fs = require('fs');


// we've started you off with Express, 
// but feel free to use whatever libs or frameworks you'd like through `package.json`.

// http://expressjs.com/en/starter/static-files.html
app.use(express.static('public'));

// http://expressjs.com/en/starter/basic-routing.html
//https://cpinheir-exportify.glitch.me/exportify.html?app_client_id=126a8bd10460421aa0be5b3a4500e143
app.get("/", function (request, response) {
  //response.sendFile(__dirname + '/exportify.html');
  //response.redirect('/exportify.html?app_client_id=126a8bd10460421aa0be5b3a4500e143');
});

app.get("/exportify.html", function (request, response) {  
  response.sendFile(__dirname + '/exportify.html');
  
   
});

app.get("/exportify.js", function (request, response) {
  response.sendFile(__dirname + '/exportify.js');
});

app.get("/dreams", function (request, response) {
  response.send(dreams);
});

// could also use the POST body instead of query string: http://expressjs.com/en/api.html#req.body
app.post("/dreams", function (request, response) {
  dreams.push(request.query.dream);
  response.sendStatus(200);
});

// Simple in-memory store for now
var dreams = [
  "Find and count some sheep",
  "Climb a really tall mountain",
  "Wash the dishes"
];

//////////////////////////////////////////////

var connected_users={};

var server=http.createServer(function(request,response){
   let path = url.parse(request.url).pathname;
   console.log(path);
   if(path === '/'){
     response.writeHead(302,  {Location: "https://cpinheir-exportify.glitch.me/exportify.html"})      
   }
   else if(path === '/exportify.html'){
     if (htmlFile != null) {
       response.writeHeader(200, {"Content-Type": "text/html"});        
       response.write(htmlFile);   
     }  
   }
   else if(path === '/exportify.js'){
     if (jsFile != null) {
       response.writeHeader(200, {"Content-Type": "text/html"});        
       response.write(jsFile);   
     }  
   }
   else{
     response.writeHead(404,{'Content-Type':'text/plain'});
     response.write('Error page');
   }
   response.end();
});

server.on('connection',function(socket){
    socket.__fd=socket.fd;
    connected_users[socket.__fd]=socket.remoteAddress;
    console.log("connected users=" + JSON.stringify(connected_users));
    socket.on('close',function(){
        delete connected_users[socket.__fd];
        console.log("connected users=" + JSON.stringify(connected_users));
    }); 
});

 var htmlFile = null;
 fs.readFile('./exportify.html', function (err, html) {
   if (err) {
    console.log("err=" + err); 
    throw err; 
   }       
   htmlFile=html;
   console.log("html=" + html);   
 });

 var jsFile = null;
 fs.readFile('./exportify.js', function (err, html) {
   if (err) {
    console.log("err=" + err); 
    throw err; 
   }       
   jsFile=html;
   console.log("html=" + html);   
 });

server.listen(process.env.PORT);


// listen for requests :)
//var listener = app.listen(process.env.PORT, function () {
//  console.log('Your app is listening on port ' + listener.address().port);
//});
