
"use strict";

var conf = require('../configuration');
var log = require('../logger');
var Eventer = require('../eventer');
var PatternsService = require('./patternsService');
const { RTMClient } = require('@slack/rtm-api');


// FIXME: use non-deprected (and better) crypto system
var sc = simplecrypt({salt:'boopdeeboop',password:'blink1control',method:"aes-192-ecb"});

var SlackService = {
    rtmClient: null,
    config: {},

    reloadConfig: function() {
        this.stop();
        this.start();
    },

    stop: function() {
        this.rtmClient.stop()
    },
    start: function() {
        var self = this;
        var config = conf.readSettings('eventServices:slackService');
        if( !config ) { config = { enabled: false, rules:[] }; }
        self.config = config;
        if( !config.enabled ) {
            log.msg("SlackService: disabled");
            return;
        }

        var allrules = conf.readSettings('eventRules') || [];
        self.rules = allrules.filter( function(r){return r.type==='slack';} );
        log.msg("SlackService.start. rules=", self.rules);

        var rule = self.rules[0]; // FIXME:
        if( !rule ) {
            return;
        }
        if( !rule.enabled ) {
            return;
        }
        let token = '';
        try {
            token = sc.decrypt( rule.userToken );
        } catch(err) {
            log.msg('SlackService: invalid user token for rule',rule.name);
            return;
        }

        self.success= false;
        Eventer.addStatus( {type:'info', source:'slack', id:rule.name, text:'connecting...'});

        const keywords = self.rules.keywords.split(",")
        var errorCount=0;
        const errorListener = (eventName, error) => {
            log.msg(`SlackService: ${errorCount} : Error occured : ${error}`);
            errorCount++;
            if (errorCount === 10) {
                log.msg(`SlackService: removing error listener`);

            }
        };
        const rtm = new RTMClient(token);
        self.rtmClient = rmt
        rtm.start()
            .catch(console.error);
        self.success = true

        rtm.on('ready', async () => {
            Eventer.addStatus( {type:'info', source:'slack', id:rule.name, text:'connected'});
        });

        rtm.on('message', (event) => {
            Eventer.addStatus( {type:'trigger', source:'slack', id:rule.name, text:event.text});
            keywords.forEach(word => {
                if (event.text && event.text.includes(word)) {
                    PatternsService.playPatternFrom( rule.name, rule.patternId, rule.blink1Id );
                }
            });
        });
        rtm.on('error', errorListener);

        (async () => {
            await rtm.start();
        })();
    }
};

module.exports = SlackService;