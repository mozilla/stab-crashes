function filter(data, buildID) {
    let lastNode = "";
    for (var info of data.builds) {
        if (!lastNode && (info.buildid == buildID)) {
            lastNode = info.node;
        } else if (lastNode && (info.buildid != buildID)) {
            return {"last": lastNode,
                    "prev": info.node};
        }
    }
    return null;
}

function fromBuildIDToPushlog(buildID) {
    buildID = buildID.trim();
    return fetch('https://hg.mozilla.org/mozilla-central/json-firefoxreleases')
                            .then(response => response.json())
                            .then(json_fxrel => {
                                let revs = filter(json_fxrel, buildID);
                                if (revs !== null) {
                                    let url1 = "https://hg.mozilla.org/mozilla-central/pushloghtml?fromchange=";
                                    let url2 = "&tochange=";
                                    return url1 + revs.prev + url2 + revs.last;
                                } else {
                                    return "";
                                }
                            })
                            .catch(error => {
                                console.log(error);
                            });
} 

function update() {
    let buildID = document.getElementById("buildID").value;
    fromBuildIDToPushlog(buildID)
        .then(url => {
            let span = document.getElementById("pushlogURL");
            if (url) {
                span.innerHTML = "<a href=\"" + url + "\">" + url + "</a>";
            } else {
                span.textContent = "Invalid build-id";
            }
        });
}
