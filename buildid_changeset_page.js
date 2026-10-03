let onLoad = new Promise(function (resolve, reject) {
  window.onload = resolve;
});

onLoad.then(function () {
  document.getElementById("getChangeset").onclick = function () {
    // e.g. 20161001030430
    fromBuildIDtoChangeset(document.getElementById("buildID").value).then(
      (changeset) =>
        (document.getElementById("getChangesetResult").textContent = changeset)
    );
  };

  document.getElementById("getBuildID").onclick = function () {
    // e.g. 87cd291d2db6
    // 1: Find date of the changeset
    // 2: Find first build ID that is greater than the date of the changeset
    // 3: Get the changeset for the build ID found in (2), if it's older than changeset, go to the next build.
    getBuildID(document.getElementById("changeset").value).then(
      (buildID) =>
        (document.getElementById("getBuildIDResult").textContent = buildID
          ? buildID
          : "Not shipped yet.")
    );
  };
});
