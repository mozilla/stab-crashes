function parseBuildID(buildID) {
  return {
    year: Number(buildID.substring(0, 4)),
    month: Number(buildID.substring(4, 6)),
    day: Number(buildID.substring(6, 8)),
    hour: Number(buildID.substring(8, 10)),
    minute: Number(buildID.substring(10, 12)),
    second: Number(buildID.substring(12, 14)),
  };
}

function compareBuildIDs(buildID1, buildID2) {
  let buildObj1 = parseBuildID(buildID1);
  let buildObj2 = parseBuildID(buildID2);

  if (buildObj1.year > buildObj2.year) {
    return 1;
  } else if (buildObj1.year < buildObj2.year) {
    return -1;
  }

  if (buildObj1.month > buildObj2.month) {
    return 1;
  } else if (buildObj1.month < buildObj2.month) {
    return -1;
  }

  if (buildObj1.day > buildObj2.day) {
    return 1;
  } else if (buildObj1.day < buildObj2.day) {
    return -1;
  }

  if (buildObj1.hour > buildObj2.hour) {
    return 1;
  } else if (buildObj1.hour < buildObj2.hour) {
    return -1;
  }

  if (buildObj1.minute > buildObj2.minute) {
    return 1;
  } else if (buildObj1.minute < buildObj2.minute) {
    return -1;
  }

  if (buildObj1.second > buildObj2.second) {
    return 1;
  } else if (buildObj1.second < buildObj2.second) {
    return -1;
  }

  return 0;
}

function toTwoDigits(num) {
  if (num < 10) {
    return "0" + num;
  }

  return num;
}

function fromBuildIDtoChangeset(buildID, channel = "nightly") {
  let buildObj = parseBuildID(buildID);

  let dirEnd;
  if (channel === "nightly") {
    dirEnd = "central";
  }

  let directory =
    "https://ftp.mozilla.org/pub/firefox/nightly/" +
    buildObj.year +
    "/" +
    toTwoDigits(buildObj.month) +
    "/" +
    buildObj.year +
    "-" +
    toTwoDigits(buildObj.month) +
    "-" +
    toTwoDigits(buildObj.day) +
    "-" +
    toTwoDigits(buildObj.hour) +
    "-" +
    toTwoDigits(buildObj.minute) +
    "-" +
    toTwoDigits(buildObj.second) +
    "-mozilla-" +
    dirEnd +
    "/";

  return fetch(directory)
    .then((response) => response.text())
    .then((data) => {
      let file = data.match(/firefox-\d+.0a[12].en-US.win32.txt/);
      if (!file) {
        file = data.match(/firefox-\d+.0a[12].en-US.linux-x86_64.txt/);
      }
      if (file && file.length == 1) {
        return file[0];
      } else {
        throw new Error(
          "Couldn't find *.win32.txt or *.linux-x86_64.txt file."
        );
      }
    })
    .then((file) => fetch(directory + file))
    .then((response) => response.text())
    .then((data) => {
      let lines = data.split("\n");
      lines = lines.map((line) => line.replace("\r", ""));
      let buildIDfromFile = lines[0];
      if (buildID != buildIDfromFile) {
        throw new Error("Unexpected error: wrong build ID in directory.");
      }
      return lines[1];
    });
}

function getRevFromChangeset(changeset, channel = "nightly") {
  let re;
  if (channel === "nightly") {
    re = /https:\/\/hg.mozilla.org\/mozilla-central\/rev\/([A-Za-z0-9]+)/;
  }
  let result = re.exec(changeset);
  return result[1];
}

function getChangesetDate(changeset, channel = "nightly") {
  let baseURL;
  if (channel === "nightly") {
    baseURL = "https://hg.mozilla.org/mozilla-central";
  }

  return fetch(baseURL + "/json-rev/" + changeset)
    .then((response) => response.json())
    .then((json_rev) => new Date(json_rev["pushdate"][0] * 1000));
}

function findFirstBuildIDInSet(buildIDs, date, i = 0) {
  return fromBuildIDtoChangeset(buildIDs[i])
    .then((buildChangeset) =>
      getChangesetDate(getRevFromChangeset(buildChangeset))
    )
    .then((buildDate) => {
      if (buildDate >= date) {
        return buildIDs[i];
      } else {
        return findFirstBuildIDInSet(buildIDs, date, i + 1);
      }
    });
}

function findFirstBuildID(date, year = null, month = null) {
  // Who knows where Firefox is built, so give the build ID some slack.
  let possibleDate = new Date(date.getTime());
  possibleDate.setUTCHours(possibleDate.getUTCHours() - 9);
  let possibleBuildID =
    "" +
    possibleDate.getUTCFullYear() +
    toTwoDigits(possibleDate.getUTCMonth() + 1) +
    toTwoDigits(possibleDate.getUTCDate()) +
    toTwoDigits(possibleDate.getUTCHours()) +
    toTwoDigits(possibleDate.getUTCMinutes()) +
    toTwoDigits(possibleDate.getUTCSeconds());

  if (year == null) {
    year = possibleDate.getUTCFullYear();
    month = possibleDate.getUTCMonth() + 1;
  }

  return fetch(
    "https://ftp.mozilla.org/pub/firefox/nightly/" +
      year +
      "/" +
      toTwoDigits(month) +
      "/"
  )
    .then((response) => response.text())
    .then((data) => {
      let re = />(\d+)-(\d\d)-(\d\d)-(\d\d)-(\d\d)-(\d\d)-mozilla-central\/</g;
      let results;

      let buildIDs = [];

      while ((results = re.exec(data)) !== null) {
        let buildID =
          results[1] +
          results[2] +
          results[3] +
          results[4] +
          results[5] +
          results[6];

        // Check if this build ID is 'newer' than date.
        if (compareBuildIDs(possibleBuildID, buildID) != 1) {
          buildIDs.push(buildID);
        }
      }

      return buildIDs;
    })
    .then((buildIDs) => {
      if (buildIDs.length === 0) {
        return null;
      }

      return findFirstBuildIDInSet(buildIDs, date);
    })
    .then((rev) => {
      if (!rev) {
        let nextYear = month + 1 == 13 ? year + 1 : year;
        let nextMonth = month + 1;
        if (nextMonth == 13) {
          nextMonth = 1;
        }

        if (
          nextYear > new Date().getUTCFullYear() ||
          (nextYear == new Date().getUTCFullYear() &&
            nextMonth > new Date().getUTCMonth() + 1)
        ) {
          return null;
        }

        return findFirstBuildID(date, nextYear, nextMonth);
      }

      return rev;
    });
}

function getBuildID(changeset) {
  return getChangesetDate(changeset).then((date) => findFirstBuildID(date));
}
