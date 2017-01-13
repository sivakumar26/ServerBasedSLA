/**
 * Created by Shounak on 5/1/2016.
 */

var express = require('express');
var http = require('http');
var router = express.Router();
var path = require('path');
const EventEmitter = require('events');
var monitor = require("os-monitor");
var os = require('os');
var cpu = require('windows-cpu');
const event = require('events');
const util = require('util');
var netstat = require('netstat');
var sync = require('deasync');
var dbStatus = 0;
var MaxConcurrentConnections = 100;
http.globalAgent.maxSockets=50;

var TotalNumberofRequests = 0;
//var CurrentConnections = 0;
var CPUTotal;
var CPUServer;
var Memusage;
var MemAvailable;

//Os-Monitor is requried to monitor different CPU Statictics at a given interval. This module is meant for linux, therefore for CPU statistics we are using
//cpu-monitor
var m = monitor.start({ delay: 1000 // interval in ms between monitor cycles
  , uptime: 5 // number of secs over which event 'uptime' is triggered
  , critical1: 0.7 // loadavg1 over which event 'loadavg1' is triggered
  , silent: false // set true to mute event 'monitor'
  , stream: false // set true to enable the monitor as a Readable Stream
  , immediate: true // set true to execute a monitor cycle at start()
});

function timedOut() {
  TotalNumberofRequests=0;
}
setTimeout(timedOut , 60000);

/* GET home page. */
router.get('/', function(req, res, next) {
  var count = 0;
  //On execution of a get request on the root, the server will start monitoring itself in a loop
  monitor.on('monitor', function(event) {
    var TempMem=0;
    //This function gets the total cpu consumption
    cpu.totalLoad(function(error, results) {
      if(error) {
        return console.log(error);
      }
      CPUTotal = results;
    });
    while(CPUTotal == undefined) {
      require('deasync').runLoopOnce();
    }

    //This function gets the total server consumption of the process node.exe (i.e our server)
    cpu.findLoad('node', function(error, results) {
      if(error) {
        return console.log(error);
      }
      CPUServer=results.load;
    });
    while(CPUServer == undefined) {
      require('deasync').runLoopOnce();
    }

    //This function calculates the total memory usage by the system at current time
    TempMem = ((((os.totalmem() - os.freemem())*0.001)/1024)/1024);
    Memusage = TempMem;

    //This function calculates the free memory of the system at current time
    TempMem = ((((os.freemem())*0.001)/1024)/1024);
    MemAvailable = TempMem;

    //This function calculates the total number of concurrent connections at current time
    var CurrentConnections;
    server.getConnections(function(error, count) {
      CurrentConnections = count;
    });
    while(CurrentConnections == undefined) {
      require('deasync').runLoopOnce();
    }


    console.log(" CPUTotal: " + CPUTotal + " CPUServer: " + CPUServer + " Memusage: " + Memusage + " MemAvailable: " + MemAvailable + " TotalNumberofRequests: " + TotalNumberofRequests + " Current Connections: " + CurrentConnections)
  });
  //res.sendFile(path.join(__dirname.substring(0, __dirname.indexOf("\\routes")) + '/views/index.html'));
  res.end();
});


//REST endpoint for Server side GUI
router.get('/gui', function(req, res, next) {
  res.sendFile(path.join(__dirname.substring(0, __dirname.indexOf("\\routes")) + '/views/index.html'));
});




//Rest endpoint to see client statistics (RESTClientfinal.html)
//Must be made with a Request-Id
router.get('/ClientCall', function(req, res, next) {
  var headers = req.headers;
  var method = req.method;
  var url = req.url;
  var body = [];
  TotalNumberofRequests = TotalNumberofRequests + 1;

  var CurrentConnections;
  server.getConnections(function(error, count) {
    CurrentConnections = count;
  });
  while(CurrentConnections == undefined) {
    require('deasync').runLoopOnce();
  }

  if (CurrentConnections > MaxConcurrentConnections){
    res.statusCode = 503;
    res.end('Too many concurrent connections, please try again.');
  }else{
    res.statusCode = 200;
    res.setHeader('CPU-Usage', CPUTotal);
    res.setHeader('Server-CPU-Usage', CPUServer);
    res.setHeader('Memory-Usage', Memusage);
    res.setHeader('Memory-Available', MemAvailable);
    res.setHeader('Number-Of-Recent-Requests', TotalNumberofRequests);
    res.setHeader('Current-Connections', CurrentConnections);
    res.setHeader('Database-Status', dbStatus);
    res.setHeader('Request-Id', req.get('Request-Id'));
    res.setHeader("Set-Cookie", "type=ninja");
    res.setHeader("Access-Control-Allow-Methods","POST, GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Expose-Headers", "CPU-Usage,Server-CPU-Usage,Memory-Usage,Memory-Available,Number-Of-Recent-Requests,Current-Connections,Database-Status,Request-Id");
    res.setHeader('Content-Type', 'application/json');
    var responseBody = {
      headers: headers,
      body: body
    };
    res.write(JSON.stringify(responseBody));
    res.end();
  }
});

router.options('/ClientCall', function(req, res, next) {
  console.log("Inside options");
  res.statusCode = 200;
  res.setHeader("Access-Control-Allow-Methods","POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader('Access-Control-Allow-Headers','Request-Id');
  res.end();
});


//Rest Endpoint to monitor the server (Use in GUI)
router.get('/monitor', function(req, res, next) {
  var headers = req.headers;
  var method = req.method;
  var url = req.url;
  var body = [];


  var CurrentConnections;
  server.getConnections(function(error, count) {
    CurrentConnections = count;
  });
  while(CurrentConnections == undefined) {
    require('deasync').runLoopOnce();
  }

  if(CurrentConnections > MaxConcurrentConnections)
  {
    res.statusCode = 503;
    res.end('Too many concurrent connections, please try again.');
  }else {
    res.statusCode = 200;
    res.setHeader("Set-Cookie", "type=ninja");
    res.setHeader("Access-Control-Allow-Methods","POST, GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader('Content-Type', 'application/json');
    var responseBody = {
      'CPUUsage': CPUTotal,
      'ServerCPUUsage': CPUServer,
      'MemoryUsage': Memusage,
      'MemoryAvailable': MemAvailable,
      'NumberOfRecentRequests': TotalNumberofRequests,
      'CurrentConnections': CurrentConnections,
      'DatabaseStatus': dbStatus
    };
    res.write(JSON.stringify(responseBody));
    res.end();
  }
});

router.options('/monitor', function(req, res, next) {
  console.log("Inside options");
  res.statusCode = 200;
  res.setHeader("Access-Control-Allow-Methods","POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader('Access-Control-Allow-Headers','temp');
  res.end();
});


//This function is used to show higher Server usage of CPU
router.get('/InfiniteLoop', function(req, res, next) {
  for(var i=0; i<5000; i++)
  {
    i++;
  }
});


router.options('/InfiniteLoop', function(req, res, next) {
  console.log("Inside options");
  res.statusCode = 200;
  res.setHeader("Access-Control-Allow-Methods","POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader('Access-Control-Allow-Headers');
  res.end();
});

module.exports = router;