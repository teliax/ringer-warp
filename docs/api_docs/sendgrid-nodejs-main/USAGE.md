# Introduction

This library is broken up into several packages as a monorepo so that you only need to install the packages necessary for your use case. 
This USAGE.md contains information about all packages. For examples on how to get started quickly, head over to the READMEs of each package (linked and described below), which includes detailed examples.

* [@sendgrid/mail](packages/mail) - if you just want to send email
* [@sendgrid/client](packages/client) - to use all other [SendGrid v3 Web API endpoints](https://sendgrid.com/docs/api-reference/)
* [@sendgrid/inbound-mail-parser](packages/inbound-mail-parser) - help with parsing the SendGrid Inbound Parse API
* [@sendgrid/contact-importer](packages/contact-importer) - help with importing contacts into the ContactDB
* [@sendgrid/helpers](packages/helpers) - a collection of classes and helpers used internally by the above packages


# Documentation

If you would like to auto-generate documentation of the packages, you can do so locally by running:
```
./node_modules/.bin/esdoc
```
Using the .esdoc.json file, esdoc will create documentation in the docs directory. 

## Checking docs coverage

You will find a coverage.json file in the docs directory. This will contain information about the documentation coverage for each of the different files in this repo.
