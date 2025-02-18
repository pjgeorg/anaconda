/*
 * Copyright (C) 2023 Red Hat, Inc.
 *
 * This program is free software; you can redistribute it and/or modify it
 * under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation; either version 2.1 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU
 * Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with This program; If not, see <http://www.gnu.org/licenses/>.
 */

import cockpit from "cockpit";
import React, { useEffect, useState } from "react";

import {
    Button,
    Form,
    FormGroup,
    FormHelperText,
    HelperText,
    HelperTextItem,
    Modal,
    ModalVariant,
    TextArea,
    TextContent,
    TextVariants,
    Text,
} from "@patternfly/react-core";
import { ExternalLinkAltIcon } from "@patternfly/react-icons";

import { exitGui } from "../helpers/exit.js";

import "./Error.scss";

const _ = cockpit.gettext;

export const bugzillaPrefiledReportURL = (productQueryData) => {
    const baseURL = "https://bugzilla.redhat.com";
    const queryData = {
        ...productQueryData,
        component: "anaconda",
    };

    const reportURL = new URL(baseURL);
    reportURL.pathname = "enter_bug.cgi";
    Object.keys(queryData).map(query => reportURL.searchParams.append(query, queryData[query]));
    return reportURL.href;
};

const addExceptionDataToReportURL = (url, exception) => {
    const newUrl = new URL(url);

    const context = exception.contextData?.context ? exception.contextData?.context + " " : "";

    newUrl.searchParams.append(
        "short_desc",
        "WebUI: " + context + exception.name + ": " + exception.message
    );
    newUrl.searchParams.append(
        "comment",
        "Installer WebUI Critical Error:\n" + context + exception.name + ": " + exception.message + "\n\n" + _("Please attach the file /tmp/webui.log to the issue.")
    );
    return newUrl.href;
};

export const CriticalError = ({ exception, isBootIso, reportLinkURL }) => {
    const reportURL = addExceptionDataToReportURL(reportLinkURL, exception);
    const [logContent, setLogContent] = useState();
    const [preparingReport, setPreparingReport] = useState(false);

    useEffect(() => {
        cockpit.spawn(["journalctl", "-a"])
                .then(content => setLogContent(content));
    }, []);

    const openBZIssue = (reportURL) => {
        setPreparingReport(true);
        cockpit
                .file("/tmp/webui.log")
                .replace(logContent)
                .always(() => setPreparingReport(false))
                .then(() => window.open(reportURL, "_blank", "noopener,noreferer"));
    };

    const context = exception.contextData?.context;

    return (
        <Modal
          description={context
              ? cockpit.format(_("The installer cannot continue due to a critical error: $0"), _(context))
              : _("The installer cannot continue due to a critical error.")}
          id="critical-error-modal"
          isOpen
          position="top"
          showClose={false}
          title={_("Critical error")}
          titleIconVariant="danger"
          variant={ModalVariant.large}
          footer={
              <>
                  {reportLinkURL &&
                  <Button
                    variant="primary"
                    isLoading={preparingReport}
                    isDisabled={logContent === undefined || preparingReport}
                    icon={<ExternalLinkAltIcon />}
                    onClick={() => openBZIssue(reportURL)}
                    component="a">
                      {preparingReport ? _("Preparing report") : _("Report issue")}
                  </Button>}
                  <Button variant="secondary" onClick={exitGui}>
                      {isBootIso ? _("Reboot") : _("Quit")}
                  </Button>
              </>
          }>
            <Form>
                <FormGroup
                  fieldId="critical-error-review-details"
                  label={_("Error details")}
                >
                    <TextContent id="critical-error-review-details">
                        <Text component={TextVariants.p}>
                            {exception.name + ": " + exception.message}
                        </Text>
                    </TextContent>
                </FormGroup>
                <FormGroup
                  fieldId="critical-error-review-attached-log"
                  label={_("Log")}
                >
                    <TextArea
                      value={logContent}
                      onChange={setLogContent}
                      resizeOrientation="vertical"
                      id="critical-error-review-attached-log"
                      isDisabled={logContent === undefined || preparingReport}
                      rows={7}
                    />
                    <FormHelperText isHidden={false}>
                        <HelperText>
                            <HelperTextItem>{_("Reporting an issue will send information over the network. Plese review and edit the attached log to remove any sensitive information.")}</HelperTextItem>
                        </HelperText>
                    </FormHelperText>
                </FormGroup>
            </Form>
        </Modal>
    );
};

export const errorHandlerWithContext = (contextData, handler) => {
    return (exception) => {
        exception.contextData = contextData;
        handler(exception);
    };
};
