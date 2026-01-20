let onLoad = new Promise(function (resolve, reject) {
  window.onload = resolve;
});

function addRow(error) {
  let table = document.getElementById("table");

  let row = table.insertRow(table.rows.length);

  let name = row.insertCell(0);
  name.appendChild(document.createTextNode(error[0]));

  let frequency = row.insertCell(1);
  frequency.appendChild(document.createTextNode(error[1]));
}

function buildTable() {
  fetch("graphics_critical_errors.json")
    .then((response) => response.json())
    .then((graphics_critical_errors) => {
      Object.entries(graphics_critical_errors)
        .sort((error1, error2) => error2[1] - error1[1])
        .forEach(addRow);
    })
    .catch(function (err) {
      console.error(err);
    });
}

onLoad
  .then(function () {
    buildTable();
  })
  .catch(function (err) {
    console.error(err);
  });
