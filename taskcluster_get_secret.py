# -*- coding: utf-8 -*-
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this file,
# You can obtain one at http://mozilla.org/MPL/2.0/.

import os
import sys

import taskcluster


def get_taskcluster_options() -> dict:
    """
    Helper to get the Taskcluster setup options
    according to current environment (local or Taskcluster)
    """
    options = taskcluster.optionsFromEnvironment()
    proxy_url = os.environ.get("TASKCLUSTER_PROXY_URL")

    if proxy_url is not None:
        # Always use proxy url when available
        options["rootUrl"] = proxy_url

    if "rootUrl" not in options:
        # Always have a value in root url
        options["rootUrl"] = "https://community-tc.services.mozilla.com"

    return options


secrets = taskcluster.Secrets(get_taskcluster_options())
secrets_dict = secrets.get("project/relman/stab-crashes/production")["secret"]
sys.stdout.write(secrets_dict[sys.argv[1]])
