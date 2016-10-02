/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

var gDebug, gLog;
var gAnalysisPath = "../../";
var gBzAPIPath = "https://bugzilla.mozilla.org/bzapi/";
var gBzBasePath = "https://bugzilla.mozilla.org/";
var gSocorroPath = "https://crash-stats.mozilla.com/";

var gSearchBase, gSearch1, gSearch2, gLimit = 20, gFetchLimit = 300;
var gSigData = {}, gSocorroAPIToken, gBugInfo = {};


window.onload = function() {
  // Socorro API token is not required, so the implementation in this code was never finished.
  gSocorroAPIToken = getParameterByName("token");
  // Fetch Super Search common parameters and specific parameters for query 1 and 2.
  searchCommon = getParameterByName("common");
  searchParam1 = getParameterByName("p1");
  searchParam2 = getParameterByName("p2");
  // Fetch limits from parameters.
  var limit = getParameterByName("limit");
  if (limit.match(/^(\d+)+$/) && (limit >= 3) && (limit <= 1000)) {
    gLimit = limit;
  }
  var flimit = getParameterByName("fetchlimit");
  if (flimit.match(/^(\d+)+$/) && (flimit >= 3) && (flimit <= 1000)) {
    gFetchLimit = flimit;
  }

  gSearch1 = searchCommon + (searchParam1 ? "&" + searchParam1 : "");
  gSearch2 = searchCommon + (searchParam2 ? "&" + searchParam2 : "");
  gSearchBase = searchCommon;

  document.getElementById("paramCommon").value = searchCommon;
  document.getElementById("paramS1").value = searchParam1;
  document.getElementById("paramS2").value = searchParam2;
  document.getElementById("search1link").href =
      gSocorroPath + "search/?" + gSearch1;
  document.getElementById("search2link").href =
      gSocorroPath + "search/?" + gSearch2;

  if (gSearch1 && gSearch2 && (gSearch1 != gSearch2)) {
    processData();
  }
  else {
    document.getElementById("scompParams").classList.remove("hidden");
    document.getElementById("scompResult").classList.add("hidden");
  }

  document.getElementById("searchParamToggle").onclick = function() {
    var paramArea = document.getElementById("scompParams");
    if (paramArea.classList.contains("hidden")) {
      paramArea.classList.remove("hidden");
    }
    else {
      paramArea.classList.add("hidden");
    }
    return false;
  }
}

function processData() {
  var tblBody = document.getElementById("scompTBody");
  displayMessage("Requesting data for first search…");
  // Only return the signature facet, no "normal" results (crash IDs).
  fetchFile(gSocorroPath + "api/SuperSearch/?_facets=signature&_results_number=0" +
            "&" + gSearch1 + "&_facets_size=" + gFetchLimit, "json",
    function(aData1) {
      if (aData1) {
        var result1 = aData1.facets.signature;
        var total1 = aData1.total;
        displayMessage("Requesting data for second search…");
        fetchFile(gSocorroPath + "api/SuperSearch/?_facets=signature&_results_number=0" +
                  "&" + gSearch2 + "&_facets_size=" + gFetchLimit, "json",
          function(aData2) {
            if (aData2) {
              var result2 = aData2.facets.signature;
              var total2 = aData2.total;
              displayMessage("Processing " + result1.length + " and " + result2.length + " results for searches…");
              // Assemble data into a form we can use.
              for (var i = 0; i <= result1.length - 1; i++) {
                gSigData[result1[i].term] = {
                  "count1": result1[i].count,
                  "pct1": 100 * result1[i].count / total1,
                  "signature": result1[i].term,
                  "count2": 0,
                  "pct2": 0,
                };
              }
              // Assemble data into a form we can use.
              for (var i = 0; i <= result2.length - 1; i++) {
                if (!gSigData[result2[i].term]) {
                  gSigData[result2[i].term] = {
                    "count1": 0,
                    "pct1": 0,
                    "signature": result2[i].term,
                  }
                }
                gSigData[result2[i].term].count2 = result2[i].count;
                gSigData[result2[i].term].pct2 = 100 * result2[i].count / total2;
              }
              // Calculate the differences.
              for (var signature in gSigData) {
                gSigData[signature].pctcmp = gSigData[signature].pct2 - gSigData[signature].pct1;
              }
              setTimeout(function() {
                buildDataTable();
                fetchBugs();
              }, 0);
            }
            else {
              displayMessage("ERROR - couldn't fetch search #2!");
            }
          }
        );
      }
      else {
        displayMessage("ERROR - couldn't fetch search #1!");
      }
    }
  );
}

function fetchBugs() {
  for (var signature in gSigData) {
    gSigData[signature].bugs = [];
    if (document.getElementById("sdata_" + encodeURIComponent(signature))) {
      // Only actually fetch if this is actually shown.
      fetchBugsForSignature(signature);
    }
  }
}

function fetchBugsForSignature(aSignature) {
  gSigData[aSignature].bugs = [];
  fetchFile(gSocorroPath + "api/Bugs/?signatures=" + encodeURIComponent(aSignature), "json",
    function(aSignature, aData) {
      if (aData) {
        for (var i = 0; i <= aData.hits.length - 1; i++) {
          if (aData.hits[i].signature == aSignature) {
            gSigData[aSignature].bugs.push(aData.hits[i].id);
          }
        }
        buildBugsField(aSignature);
      }
      else {
        console.log("ERROR - couldn't find bug data for " + aSignature + "!");
      }
    }.bind(undefined, aSignature) // Prepend signature to the argument list.
  );
}

function buildDataTable() {
  var msgRow = document.getElementById("message_row");
  if (msgRow) {
    msgRow.parentNode.removeChild(msgRow);
  }
  // Header
  var trow = document.getElementById("scompTHeader")
                     .appendChild(document.createElement("tr"));
  var cell = trow.appendChild(document.createElement("th"));
  cell.textContent = "#";
  cell.setAttribute("title", "Rank");
  var cell = trow.appendChild(document.createElement("th"));
  cell.textContent = "Signature";
  var cell = trow.appendChild(document.createElement("th"));
  cell.textContent = "Bugs";
  var cell = trow.appendChild(document.createElement("th"));
  cell.textContent = "#1";
  var cell = trow.appendChild(document.createElement("th"));
  cell.textContent = "#2";
  var cell = trow.appendChild(document.createElement("th"));
  cell.textContent = "+/-";
  // Body
  var tblBody = document.getElementById("scompTBody");
  var sigSorted = Object.keys(gSigData).sort(
    function (a, b) { return Math.abs(gSigData[b].pctcmp) - Math.abs(gSigData[a].pctcmp); }
  );
  var listNum = Math.min(gLimit, sigSorted.length);
  for (var i = 0; i <= listNum - 1; i++) {
    signature = sigSorted[i];
    var trow = tblBody.appendChild(document.createElement("tr"));
    trow.setAttribute("id", "sdata_" + encodeURIComponent(signature));
    var cell = trow.appendChild(document.createElement("td"));
    cell.textContent = i + 1;
    cell.classList.add("rank");
    var cell = trow.appendChild(document.createElement("td"));
    cell.classList.add("sig");
    var link = cell.appendChild(document.createElement("a"));
    link.setAttribute("href",
        gSocorroPath + "signature?" + gSearchBase +
        "&signature=" + encodeURIComponent(signature));
    link.textContent = signature;
    var cell = trow.appendChild(document.createElement("td"));
    cell.classList.add("bugs");
    var cell = trow.appendChild(document.createElement("td"));
    cell.classList.add("pct");
    cell.textContent = gSigData[signature].pct1.toFixed(1) + "%";
    cell.setAttribute("title", gSigData[signature].count1);
    if (gSigData[signature].count1 == 0) {
      cell.classList.add("zero");
    }
    var cell = trow.appendChild(document.createElement("td"));
    cell.classList.add("pct");
    cell.textContent = gSigData[signature].pct2.toFixed(1) + "%";
    cell.setAttribute("title", gSigData[signature].count2);
    if (gSigData[signature].count2 == 0) {
      cell.classList.add("zero");
    }
    var cell = trow.appendChild(document.createElement("td"));
    cell.classList.add("pctcmp");
    if (gSigData[signature].pctcmp > 0) {
      cell.classList.add("plus");
    }
    else if (gSigData[signature].pctcmp < 0) {
      cell.classList.add("minus");
    }
    cell.textContent = (gSigData[signature].pctcmp > 0 ? "+" : "") +
                       gSigData[signature].pctcmp.toFixed(1) + "%";
  }
}

function buildBugsField(aSignature) {
  var sigRow = document.getElementById("sdata_" + encodeURIComponent(aSignature));
  var bugsField = sigRow.querySelector(".bugs");
  for (var i = 0; i <= gSigData[aSignature].bugs.length - 1; i++) {
    if (i > 0) { // Add spaces when we have multiple bugs.
      bugsField.appendChild(document.createTextNode(" "));
    }
    var link = bugsField.appendChild(document.createElement("a"));
    link.dataset["bugid"] = gSigData[aSignature].bugs[i];
    link.setAttribute("href",
        gBzBasePath + "show_bug.cgi?id=" + gSigData[aSignature].bugs[i]);
    link.textContent = gSigData[aSignature].bugs[i];
    // Add Bugzilla data.
    if (gBugInfo[gSigData[aSignature].bugs[i]]) {
      beautifyBugzillaLink(link);
    }
    else {
      fetchFile(gBzBasePath + "rest/bug/" + gSigData[aSignature].bugs[i] + "?include_fields=id,summary,status,resolution", "json",
        function(aLink, aData) {
          if (aData && aData.bugs && aData.bugs.length) {
            gBugInfo[aData.bugs[0].id] = aData.bugs[0];
            beautifyBugzillaLink(aLink);
          }
          else if (aData && aData.error) {
            // On error, create fake bug info.
            gBugInfo[aLink.dataset["bugid"]] =
              {status: "ERROR", resolution: "", summary: aData.message};
            beautifyBugzillaLink(aLink);
          }
          else {
            console.log("ERROR - couldn't find info for bug " + aLink.dataset["bugid"] + "!");
          }
        }.bind(undefined, link), // Prepend link to the argument list.
        true // Accept 401 responses and still return them as JSON.
      );
    }
  }
}

function beautifyBugzillaLink(aLink) {
  if (gBugInfo[aLink.dataset["bugid"]]) {
    aLink.dataset["status"] = gBugInfo[aLink.dataset["bugid"]].status;
    aLink.dataset["resolution"] = gBugInfo[aLink.dataset["bugid"]].resolution;
    aLink.title = gBugInfo[aLink.dataset["bugid"]].status + " " +
                  gBugInfo[aLink.dataset["bugid"]].resolution + " - " +
                  gBugInfo[aLink.dataset["bugid"]].summary;
  }
  else {
    console.log("ERROR - info for bug " + aLink.dataset["bugid"] + " should exist but doesn't!");
  }
}

function displayMessage(aErrorMessage) {
  var msgRow = document.getElementById("message_row");
  if (msgRow) {
    msgRow.parentNode.removeChild(msgRow);
  }
  var trow = document.getElementById("scompTBody")
                     .appendChild(document.createElement('tr'));
  trow.setAttribute("id", "message_row");
  var cell = trow.appendChild(document.createElement('td'));
  cell.textContent = aErrorMessage;
  return cell;
}

function fetchFile(aURL, aFormat, aCallback, aAccept401) {
  var XHR = new XMLHttpRequest();
  XHR.onreadystatechange = function() {
    if (XHR.readyState == 4) {/*
      gLog.appendChild(document.createElement("li"))
          .appendChild(document.createTextNode(aURL + " - " + XHR.status +
                                               " " + XHR.statusText));*/
    }
    if (XHR.readyState == 4 && (XHR.status == 200 || (XHR.status == 401 && aAccept401))) {
      // so far so good
      if (XHR.responseXML != null && aFormat == "xml" &&
          XHR.responseXML.getElementById('test').firstChild.data)
        aCallback(aXHR.responseXML.getElementById('test').firstChild.data);
      else if (XHR.responseText != null && aFormat == "json")
        aCallback(JSON.parse(XHR.responseText));
      else
        aCallback(XHR.responseText);
    } else if (XHR.readyState == 4 && XHR.status != 200) {
      // fetched the wrong page or network error...
      console.log("ERROR: XHR status " + XHR.status + " - " + aURL);
      aCallback(null);
    }
  };
  XHR.open("GET", aURL);
  if (gSocorroAPIToken) {
    // XXX: Should work but doesn't yet! We'll need to figure this out.
    //      Use this path when we have a token so bug 1143424 can be tested.
    XHR.setRequestHeader("Auth-Token", gSocorroAPIToken);
  }
  if (aFormat == "json") { XHR.setRequestHeader("Accept", "application/json"); }
  else if (aFormat == "xml") { XHR.setRequestHeader("Accept", "application/xml"); }
  try {
    XHR.send();
  }
  catch (e) {
    console.log("ERROR: XHR send - " + e + " - " + aURL);
    aCallback(null);
  }
}

function getParameterByName(aName) {
  // from http://stackoverflow.com/questions/901115/how-can-i-get-query-string-values-in-javascript
  name = aName.replace(/[\[]/, "\\[").replace(/[\]]/, "\\]");
  var regex = new RegExp("[\\?&]" + name + "=([^&#]*)"),
      results = regex.exec(location.search);
  return results === null ? "" : decodeURIComponent(results[1].replace(/\+/g, " "));
}
