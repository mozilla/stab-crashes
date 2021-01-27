# -*- coding: utf-8 -*-
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this file,
# You can obtain one at http://mozilla.org/MPL/2.0/.

import re

import libmozdata.socorro as socorro
import libmozdata.utils as utils
import requests
from libmozdata.connection import Query


def query_searchfox(q):
    r = requests.get(
        "https://searchfox.org/mozilla-central/search",
        params={"q": q, "limit": 1000},
        headers={"Accept": "application/json"},
    )

    if r.status_code != 200:
        print(r.text)
        raise Exception(r)

    return sum((result for result in r.json()["normal"].values()), [])


def get_critical_errors():
    results = (
        query_searchfox("gfxCriticalError(")
        + query_searchfox("gfxCriticalNote <<")
        + query_searchfox("gfxCriticalErrorOnce(")
    )

    matches = [
        re.search(r'"(.*?)"', line["line"])
        for result in results
        for line in result["lines"]
    ]

    errors = [match.group(1) for match in matches if match is not None]

    return set([error for error in errors if error != ", "])


def analyze_gfx_critical_errors(
    signature="", product="Firefox", channel=["all"], start_date=""
):
    if product.lower() == "firefox":
        product = "Firefox"

    if channel == [] or channel[0].lower() == "all":
        channel = ["release", "beta", "nightly"]
        if product == "Firefox":
            channel.append("esr")
    else:
        channel = [c.lower() for c in channel]

    if not start_date:
        start_date = utils.get_date("today", 7)

    gfx_critical_errors = get_critical_errors()

    count = {}

    def handler(json, gfx_critical_error):
        count[gfx_critical_error] = json["total"]

    base_params = {
        "product": product,
        "release_channel": channel,
        "date": ">=" + start_date,
        "_results_number": 0,
        "_facets_size": 0,
    }

    if signature:
        base_params["signature"] = signature

    queries = []
    for gfx_critical_error in gfx_critical_errors:
        params = base_params.copy()
        params["graphics_critical_error"] = "~" + gfx_critical_error
        queries.append(
            Query(
                socorro.SuperSearch.URL,
                params=params,
                handler=handler,
                handlerdata=gfx_critical_error,
            )
        )

    socorro.SuperSearch(queries=queries).wait()

    return count
