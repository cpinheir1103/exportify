// NOTE: this app uses Spotify's 'Implicit Grant' authorization flow.

// from https://developer.spotify.com/documentation/web-api/ 
//"Rate Limiting enables Web API to share access bandwidth to its resources equally across all users.
//Rate limiting is applied as per application based on Client ID, and regardless of the number of users who use the application simultaneously.""

// Due to this fact, if you had multiple users logged in using the same client ID, there combined usage would be used measure against the rate limit. The 
// problem is, when the rate limit is reached and the 'try again in X seconds' message is returned to client(s), I would guess each client will get the same wait time,
// and will probably end up all sending requests at the same time when timeout expires. Probably a good idea would be to have the server keep track of how many users 
// are currently logged in, and when the client gets a wait time message, send it to the server. The server can then keep track of the times, and notify the client when 
// it's OK to request again. As a simlper solution for the time being, just have the clients wait for a longer period of time than the wait messages specifies (2x, 5x, 10x?)

///////////////////////////////
function doDelay(ms) {
    var unixtime_ms = new Date().getTime();
    while(new Date().getTime() < unixtime_ms + ms) {}
}

window.Helpers = {
  authorize: function() {
    var client_id = this.getQueryParam('app_client_id');

    // Use Exportify application client_id if none given
    if (client_id == '') {
      client_id = "126a8bd10460421aa0be5b3a4500e143"
    }

    window.location = "https://accounts.spotify.com/authorize" +
      "?client_id=" + client_id +
      "&redirect_uri=" + encodeURIComponent([location.protocol, '//', location.host, location.pathname].join('')) +
      "&scope=playlist-read-private%20playlist-read-collaborative" +
      "&response_type=token";
  },

  // http://stackoverflow.com/a/901144/4167042
  getQueryParam: function(name) {
    name = name.replace(/[\[]/, "\\[").replace(/[\]]/, "\\]");
    var regex = new RegExp("[\\?&]" + name + "=([^&#]*)"),
        results = regex.exec(location.search);
    return results === null ? "" : decodeURIComponent(results[1].replace(/\+/g, " "));
  },

  apiCall: function(url, access_token) {
    //console.log("ajax:" + url);
    //alert("ajax: " + url);
    return $.ajax({
      url: url,
      headers: {
        'Authorization': 'Bearer ' + access_token
      }
    }).fail(function (jqXHR, textStatus) {
      if (jqXHR.status == 401) {
        // Return to home page after auth token expiry
        window.location = window.location.href.split('#')[0]
      } else if (jqXHR.status == 429) {
        // API Rate-limiting encountered
        console.log("jqXHR.responseText=" + JSON.stringify(jqXHR.responseText));
        window.location = window.location.href.split('#')[0] + '?rate_limit_message=true'
      } else {
        // Otherwise report the error so user can raise an issue
        alert(jqXHR.responseText);
      }
    })
  }
}

var PlaylistTable = React.createClass({
  getInitialState: function() {
    return {
      playlists: [],
      playlistCount: 0,
      nextURL: null,
      prevURL: null
    };
  },

  loadPlaylists: function(url) {
    var userId = '';
    var firstPage = typeof url === 'undefined' || url.indexOf('offset=0') > -1;

    window.Helpers.apiCall("https://api.spotify.com/v1/me", this.props.access_token).then(function(response) {
      userId = response.id;

      // Show starred playlist if viewing first page
      if (firstPage) {
        return $.when.apply($, [
          window.Helpers.apiCall(
            "https://api.spotify.com/v1/users/" + userId + "/starred",
            this.props.access_token
          ),
          window.Helpers.apiCall(
            "https://api.spotify.com/v1/users/" + userId + "/playlists",
            this.props.access_token
          )
        ])
      } else {
        return window.Helpers.apiCall(url, this.props.access_token);
      }
    }.bind(this)).done(function() {
      var response;
      var playlists = [];

      if (arguments[1] === 'success') {
        response = arguments[0];
        playlists = arguments[0].items;
      } else {
        response = arguments[1][0];
        playlists = $.merge([arguments[0][0]], arguments[1][0].items);
      }

      if (this.isMounted()) {
        this.setState({
          playlists: playlists,
          playlistCount: response.total,
          nextURL: response.next,
          prevURL: response.previous
        });

        $('#playlists').fadeIn();
        $('#subtitle').text((response.offset + 1) + '-' + (response.offset + response.items.length) + ' of ' + response.total + ' playlists for ' + userId)
      }
    }.bind(this))
  },

  timerExpire: function(ndx) {
    console.log("CALLING timerExpire()!!!!!");
    PlaylistsExporter.export(this.props.access_token, ndx);
    if ((ndx+1) < this.state.playlistCount)
      setTimeout(this.timerExpire.bind(null, ndx+1), 1000);
  },
   
  exportPlaylists: function() {
    setTimeout(this.timerExpire.bind(null, 0), 1000);
    
    //for (var cnt=0; cnt < this.state.playlistCount; cnt++)
    //  PlaylistsExporter.export(this.props.access_token, cnt);
      //PlaylistsExporter.export(this.props.access_token, this.state.playlistCount);
  },

  componentDidMount: function() {
    this.loadPlaylists(this.props.url);
  },

  render: function() {
    if (this.state.playlists.length > 0) {
      return (
        <div id="playlists">
          <Paginator nextURL={this.state.nextURL} prevURL={this.state.prevURL} loadPlaylists={this.loadPlaylists}/>
          <table className="table table-hover">
            <thead>
              <tr>
                <th style={{width: "30px"}}></th>
                <th>Name</th>
                <th style={{width: "150px"}}>Owner</th>
                <th style={{width: "100px"}}>Tracks</th>
                <th style={{width: "120px"}}>Public?</th>
                <th style={{width: "120px"}}>Collaborative?</th>
                <th style={{width: "100px"}} className="text-right"><button className="btn btn-default btn-xs" type="submit" onClick={this.exportPlaylists}><span className="fa fa-file-archive-o"></span> Export All</button><input id="plMin" placeholder="min" /><input id="plMax" placeholder="max" /></th>
              </tr>
            </thead>
            <tbody>
              {this.state.playlists.map(function(playlist, i) {
                return <PlaylistRow playlist={playlist} key={playlist.id} access_token={this.props.access_token}/>;
              }.bind(this))}
            </tbody>
          </table>
          <Paginator nextURL={this.state.nextURL} prevURL={this.state.prevURL} loadPlaylists={this.loadPlaylists}/>
        </div>
      );
    } else {
      return <div className="spinner"></div>
    }
  }
});

var PlaylistRow = React.createClass({
  exportPlaylist: function() {
    PlaylistExporter.export(this.props.access_token, this.props.playlist);
  },

  renderTickCross: function(condition) {
    if (condition) {
      return <i className="fa fa-lg fa-check-circle-o"></i>
    } else {
      return <i className="fa fa-lg fa-times-circle-o" style={{ color: '#ECEBE8' }}></i>
    }
  },

  renderIcon: function(playlist) {
    if (playlist.name == 'Starred') {
      return <i className="glyphicon glyphicon-star" style={{ color: 'gold' }}></i>;
    } else {
      return <i className="fa fa-music"></i>;
    }
  },

  render: function() {
    playlist = this.props.playlist
    //console.log("playlist=" + JSON.stringify(playlist));
    
    if (playlist.owner == null)
      return null   
    else 
      return (
        <tr key={this.props.key}>
          <td>{this.renderIcon(playlist)}</td>
          <td><a href={playlist.uri}>{playlist.name}</a></td>
          <td><a href={playlist.owner.uri}>{playlist.owner.id}</a></td>
          <td>{playlist.tracks.total}</td>
          <td>{this.renderTickCross(playlist.public)}</td>
          <td>{this.renderTickCross(playlist.collaborative)}</td>
          <td className="text-right"><button className="btn btn-default btn-xs btn-success" type="submit" onClick={this.exportPlaylist}><span className="glyphicon glyphicon-save"></span> Export</button></td>
        </tr>
      );
  }
});

var Paginator = React.createClass({
  nextClick: function(e) {
    e.preventDefault()

    if (this.props.nextURL != null) {
      this.props.loadPlaylists(this.props.nextURL)
    }
  },

  prevClick: function(e) {
    e.preventDefault()

    if (this.props.prevURL != null) {
      this.props.loadPlaylists(this.props.prevURL)
    }
  },

  render: function() {
    if (this.props.nextURL != null || this.props.prevURL != null) {
      return (
        <nav className="paginator text-right">
          <ul className="pagination pagination-sm">
            <li className={this.props.prevURL == null ? 'disabled' : ''}>
              <a href="#" aria-label="Previous" onClick={this.prevClick}>
                <span aria-hidden="true">&laquo;</span>
              </a>
            </li>
            <li className={this.props.nextURL == null ? 'disabled' : ''}>
              <a href="#" aria-label="Next" onClick={this.nextClick}>
                <span aria-hidden="true">&raquo;</span>
              </a>
            </li>
          </ul>
        </nav>
      )
    } else {
      return <div>&nbsp;</div>
    }
  }
});

// Handles exporting all playlist data as a zip file
var PlaylistsExporter = {
  export: function(access_token, playlistCount) {
    var playlistFileNames = [];

    window.Helpers.apiCall("https://api.spotify.com/v1/me", access_token).then(function(response) {
      var limit = 20;
      var userId = response.id;

      // Initialize requests with starred playlist
      var requests = [
        window.Helpers.apiCall(
          "https://api.spotify.com/v1/users/" + userId + "/starred",
          access_token
        )
      ];

      // Add other playlists
      //for (var offset = 0; offset < playlistCount; offset = offset + limit) {
        var offset = playlistCount;  // ADDED BY CSP
        var url = "https://api.spotify.com/v1/users/" + userId + "/playlists";
        requests.push(          window.Helpers.apiCall(url + '?offset=' + offset + '&limit=' + 1, access_token)
        //requests.push(          window.Helpers.apiCall(url + '?offset=' + offset + '&limit=' + limit, access_token)
          
        )

      //}

      $.when.apply($, requests).then( function() {
        var playlists = [];
        var playlistExports = [];

        // Handle either single or multiple responses
        if (typeof arguments[0].href == 'undefined') {
          $(arguments).each(function(i, response) {
            if (typeof response[0].items === 'undefined') {
              // Single playlist
              playlists.push(response[0]);
            } else {
              // Page of playlists
              $.merge(playlists, response[0].items);
            }
          })
        } else {
          playlists = arguments[0].items
        }

       
        $(playlists).each(function(i, playlist) {
          //var minVal = document.getElementById("plMin").value;
          //var maxVal = document.getElementById("plMax").value;
          //if ((i >= minVal) && (i <= maxVal))  // CSP - test limiting batch saving. 100 seems to be a good number.          
          //{ 
            //console.log("playlist " + i +":" + JSON.stringify(playlist));
            console.log("playlist " + i +":" + JSON.stringify(playlist.name));
            playlistFileNames.push(PlaylistExporter.fileName(playlist));
            playlistExports.push(PlaylistExporter.csvData(access_token, playlist));
            //doDelay(3000);
            
          //}
        });
        
        
        
        //throw new Error();  // CSP - to exit script early
        console.log("returning!");

        return $.when.apply($, playlistExports);
      }).then(function() {
        console.log("making zip file!");
        var zip = new JSZip();
        var responses = [];

        $(arguments).each(function(i, response) {
          zip.file(playlistFileNames[i], response)
        });

        var content = zip.generate({ type: "blob" });
        saveAs(content, "spotify_playlist_" + playlistFileNames[1] + ".zip");
      });
    });
  }
}

// Handles exporting a single playlist as a CSV file
var PlaylistExporter = {
  export: function(access_token, playlist) {    
    this.csvData(access_token, playlist).then(function(data) {
      var blob = new Blob(["\uFEFF" + data], { type: "text/csv;charset=utf-8" });
      saveAs(blob, this.fileName(playlist));
    }.bind(this))
  },

  csvData: function(access_token, playlist) {
    var requests = [];
    var limit = 100;
    
    if (playlist.name == "Starred")
      return;

    for (var offset = 0; offset < playlist.tracks.total; offset = offset + limit) {
      requests.push(
        window.Helpers.apiCall(playlist.tracks.href.split('?')[0] + '?offset=' + offset + '&limit=' + limit, access_token)
      )
      //console.log("REQ TRACKS FOR PLAYLIST " + playlist.name);
      doDelay(1000);
    }

    return $.when.apply($, requests).then(function() {
      var responses = [];

      // Handle either single or multiple responses
      if (typeof arguments[0] != 'undefined') {
        if (typeof arguments[0].href == 'undefined') {
          responses = Array.prototype.slice.call(arguments).map(function(a) { return a[0] });
        } else {
          responses = [arguments[0]];
        }
      }

      var tracks = responses.map(function(response) {
        return response.items.map(function(item) {
          //console.log("TRACK= " + item.track.name);
          return [         
            item.track.uri,
            item.track.name,
            item.track.artists.map(function(artist) { return artist.name }).join(', '),
            item.track.album.name,
            item.track.disc_number,
            item.track.track_number,
            item.track.duration_ms,
            item.added_by == null ? '' : item.added_by.uri,
            item.added_at
          ].map(function(track) { return '"' + track + '"'; })
        });
      });

      // Flatten the array of pages
      tracks = $.map(tracks, function(n) { return n })

      tracks.unshift([
        "Spotify URI",
        "Track Name",
        "Artist Name",
        "Album Name",
        "Disc Number",
        "Track Number",
        "Track Duration (ms)",
        "Added By",
        "Added At"
      ]);

      csvContent = '';
      tracks.forEach(function(infoArray, index){
        dataString = infoArray.join(",");
        csvContent += index < tracks.length ? dataString+ "\n" : dataString;
      });

      return csvContent;
    });
  },

  fileName: function(playlist) {
    return playlist.name.replace(/[^a-z0-9\- ]/gi, '').replace(/[ ]/gi, '_').toLowerCase() + ".csv";
  }
}


////////////////////////////////////////////////////////////////////////////////////
var userIDGlobal;
var accessTokenGlobal;
var playlistsGlobal = [];
var playlistCountGlobal = 0;
var tempGlobal;
var ratelimitGlobal;

function getUserId(access_token) {  
  var url = "https://api.spotify.com/v1/me";
  var retVal;
    $.ajax({
      url: url,
      headers: {
        'Authorization': 'Bearer ' + access_token
      }
    })
    .done(function(data) {
      console.log("data=" + JSON.stringify(data));
      userIDGlobal = data.id;
      //playlistCountGlobal = data.total;
      getPlaylistsList(accessTokenGlobal,userIDGlobal,0);      
    }) 
    .fail(function (jqXHR, textStatus) {
        if (jqXHR.status == 401) {
          // Return to home page after auth token expiry
          window.location = window.location.href.split('#')[0]
        } else if (jqXHR.status == 429) {
          // API Rate-limiting encountered
          console.log("jqXHR.responseText=" + JSON.stringify(jqXHR.responseText));
          window.location = window.location.href.split('#')[0] + '?rate_limit_message=true'
        } else {
          // Otherwise report the error so user can raise an issue
          alert(jqXHR.responseText);
        }
      })
  
}

function getPlaylistsList(access_token, userId, offset) {
  // have to loop, as max response is 50 playlists at a time.
  var limit = 50;      
  var url = "https://api.spotify.com/v1/users/" + userId + "/playlists?offset=" + offset + '&limit=' + limit;  
  var retVal = $.ajax({
      url: url,
      headers: {
        'Authorization': 'Bearer ' + access_token
      }
    })
    .done(function(data) {
        playlistsGlobal = playlistsGlobal.concat(data.items);   // merge arrays
        console.log("data=" + JSON.stringify(data));
        playlistCountGlobal = playlistCountGlobal + data.items.length;
        // call recursively until no more playlists left
        if (data.items.length == limit)
          getPlaylistsList(access_token, userId, offset + limit) ;
        else {
          // now get all individual playlist info by index
          console.log("playlistCountGlobal=" + playlistCountGlobal);
          for (var i=0; i<playlistCountGlobal; i++) {
            console.log("playlist name=" + playlistsGlobal[i].name);
            getPlaylist(access_token, i);
            
            //return;
          }
         
        }  
    })  
    .fail(function (jqXHR, textStatus) {
        if (jqXHR.status == 401) {
          // Return to home page after auth token expiry
          window.location = window.location.href.split('#')[0]
        } else if (jqXHR.status == 429) {          // API Rate-limiting encountered
          
          console.log("jqXHR.responseText=" + JSON.stringify(jqXHR.responseText));
          window.location = window.location.href.split('#')[0] + '?rate_limit_message=true'
        } else {
          // Otherwise report the error so user can raise an issue
          alert(jqXHR.responseText);
        }
      })

}

function getPlaylist(access_token, ndx) {
  
  var url = playlistsGlobal[ndx].tracks.href.split('?')[0];                      
  var retVal = $.ajax({
      url: url,
      headers: {
        'Authorization': 'Bearer ' + access_token
      }
    })
    .done(function(data) {
        tempGlobal = data;
        //console.log("data=" + JSON.stringify(data));
        var totalTracks = data.total;  // number of tracks in all pages
        var numTracks; // number of tracks in this page
      
        if (totalTracks > 100)
          numTracks = 100;
        else
          numTracks = totalTracks;
        // will need to call api to get next page of tracks if more than 100
        for (var i=0; i<numTracks; i++) {
          console.log("numTracks = " + numTracks);
          console.log("track=" + data.items[0].track.track_number + " " + data.items[0].track.name);
        }
    })  
    .fail(function (jqXHR, textStatus) {
        if (jqXHR.status == 401) {
          // Return to home page after auth token expiry
          window.location = window.location.href.split('#')[0]
        } else if (jqXHR.status == 429) {
          ratelimitGlobal = jqXHR;
          // API Rate-limiting encountered
          var retryVal = jqXHR.getResponseHeader('Retry-After');
          console.log("retryVal=" + retryVal);
          doDelay(retryVal * 1000);  // waiting the designated amount doesn't seem to guarantee next call will not be rate-limited???
          //console.log("jqXHR.responseText=" + JSON.stringify(jqXHR.responseText));
          //CSP window.location = window.location.href.split('#')[0] + '?rate_limit_message=true'
        } else {
          // Otherwise report the error so user can raise an issue
          alert(jqXHR.responseText);
        }
      })
  
  doDelay(1000);

}

//////////////////////////////////////////////////////////////////////////////////


$(function() {
  var vars = window.location.hash.substring(1).split('&');
  var key = {};
  for (var i=0; i<vars.length; i++) {
    var tmp = vars[i].split('=');
    key[tmp[0]] = tmp[1];
  }

  if (window.Helpers.getQueryParam('rate_limit_message') != '') {
    // Show rate limit message
    $('#rateLimitMessage').show();
  } else if (typeof key['access_token'] === 'undefined') {
    $('#loginButton').css('display', 'inline-block')
  } else {
    //React.render(<PlaylistTable access_token={key['access_token']} />, playlistsContainer);
    accessTokenGlobal = key['access_token'];
    userIDGlobal = getUserId(accessTokenGlobal);
  }
});
