function initialize() {
    db = new ydn.db.Storage('protip', schema);
    updateFiatCurrencyCode();
    allowExternalLinks();
    initCurrentWeek();
}

function daysTillEndOWeek(endOfWeek) {
    var now = (new Date).getTime();
    var milliseconds = endOfWeek - now;
    return millisecondsToDays(milliseconds)
}

function initCurrentWeek() {
    var now = (new Date).getTime();
    if (parseInt(localStorage['endOfWeek']) > now) {
        // All okay, all variables set,
        var milliSecondsInWeek = 604800000;
        var extraHour = 3600000; // add an hour to help the UI design.

        var alarm = now + milliSecondsInWeek + extraHour

        var endOfWeek = new Date(parseInt(localStorage['endOfWeek']));

        var daysRemaining = daysTillEndOWeek(endOfWeek)

        $('#days-till-end-of-week').html(daysRemaining);

        $('#date-end-of-week').html(endOfWeek.format("dddd, mmmm dS, yyyy, h:MM:ss TT"));

    } else {
        // Catch any missing variables and other rubbish, just restart.
        // Good for initalization on first load.
        restartTheWeek();
    }
}


function restartTheWeek() {
    var now = (new Date).getTime();
    var milliSecondsInWeek = 604800000;
    var extraHour = 3600000; // add an hour to help the UI design.

    var alarm = now + milliSecondsInWeek + extraHour;

    var endOfWeek = new Date(alarm);

    var daysRemaining = daysTillEndOWeek(endOfWeek);

    localStorage['endOfWeek'] = alarm;

    $('#days-till-end-of-week').html(daysRemaining);
    $('#days-till-end-of-week').effect("highlight", {
        color: 'rgb(100, 189, 99)'
    }, 1000);

    $('#date-end-of-week').html(endOfWeek.format("dddd, mmmm dS, yyyy, h:MM:ss TT"));
    $('#date-end-of-week').effect("highlight", {
        color: 'rgb(100, 189, 99)'
    }, 1000);

    $('#donate-now-reminder').fadeOut();
}

function millisecondsToDays(milliseconds) {
    var seconds = Math.floor(milliseconds / 1000);
    var minutes = Math.floor(seconds / 60);
    var hours = Math.floor(minutes / 60);
    var days = Math.floor(hours / 24);
    return days;
}

$(document).ready(function() {
    if(!localStorage['proTipInstalled']) {
        window.location.replace("install.html");
    }

    initialize();

    $( "#slider" ).slider({
        range: "max",
        min: 0.01,
        max: 10,
        value: parseFloat(localStorage['incidentalTotalFiat']),
        slide: function( event, ui ) {
          $( "#incidental-fiat-amount" ).val( ui.value );
          $('#incidental-fiat-amount').trigger('change');
        }
    });

    // Setup the wallet, page values and callbacks
    var val = '',
        address = '',
        SATOSHIS = 100000000,
        FEE = SATOSHIS * .0001,
        BTCUnits = 'BTC',
        BTCMultiplier = SATOSHIS;

    function setupWallet() {
        wallet.restoreAddress().then(setQRCodes,
            function() {
                return wallet.generateAddress();
            }).then(setQRCodes,
            function() {
                alert('Failed to generate wallet. Refresh and try again.');
            });

        function setQRCodes() {
            $('#qrcode').html(createQRCodeCanvas(wallet.getAddress()));
            $('#textAddress').text(wallet.getAddress());
        }
    }
    wallet.setBalanceListener(function(balance) {
        setBalance(balance);
        if(balance == '0'){ $('#buy-bitcoins-info').show() }
        Promise.all([currencyManager.amount(balance), currencyManager.amount(FEE)]).then(function(results) {
            localStorage['availableBalanceFiat'] = results[0];
            //setBudgetWidget(results[0], results[1]);
        });
    });
    setupWallet();

    $('#amount').on('keyup change', function() {
        val = Math.floor(Number($(this).val() * BTCMultiplier));
        if (val > 0) {
            currencyManager.formatAmount(val).then(function(formattedMoney) {
                var text = 'Amount: ' + formattedMoney;
                $('#amountLabel').text(text);
            });
        } else {
            $('#amountLabel').text('Amount:');
        }
    });

    function setBTCUnits(units) {
        BTCUnits = units;
        if (units === 'µBTC') {
            BTCMultiplier = SATOSHIS / 1000000;
        } else if (units === 'mBTC') {
            BTCMultiplier = SATOSHIS / 1000;
        } else {
            BTCMultiplier = SATOSHIS;
        }

        setBalance(wallet.getBalance());
        $('#sendUnit').html(BTCUnits);
        $('#amount').attr('placeholder', '(Plus ' + FEE / BTCMultiplier + ' ' + BTCUnits + ' fee)').attr('step', 100000 / BTCMultiplier).val(null);
        $('#amountLabel').text('Amount:');
    }
    preferences.getBTCUnits().then(setBTCUnits);

    function setBalance(balance) {
        if (Number(balance) < 0 || isNaN(balance)) {
            balance = 0;
        }
        $('#head-line-balance').text(parseInt(balance) / BTCMultiplier + ' ' + BTCUnits);
        $('#balance').text(parseInt(balance) / BTCMultiplier + ' ' + BTCUnits);
        $('#bitcoin-fee').text((10000 / BTCMultiplier + ' ' + BTCUnits));
        if(parseInt(balance) > 0){
          $('#max-available-balance').text((parseInt(balance - FEE) / BTCMultiplier) + ' ' + BTCUnits);
        } else {
          $('#max-available-balance').text('0.00' + ' ' + BTCUnits);
        }
        if (balance > 0) {
            currencyManager.formatAmount(balance).then(function(formattedMoney) {
                var text = formattedMoney;
                $('#btc-balance-to-fiat').text(text);
            });
        } else {
            $('#btc-balance-to-fiat').text('0.00');
        }
    }

    $('#successAlertClose').click(function() {
        $('#successAlert').fadeOut();
        if (typeof chrome === 'undefined') {
            addon.port.emit('resize', 278);
        }
    });

    $('#unkownErrorAlertClose').click(function() {
        $('#unknownErrorAlert').fadeOut();
    });

    if (typeof chrome === 'undefined') {
        addon.port.on('show', setupWallet);
    }

    /*
     *  Send BTC
     */
    $('#sendButton').click(function() {
        val = Math.floor(Number($('#amount').val() * BTCMultiplier));
        address = $('#sendAddress').val();
        var balance = wallet.getBalance();
        var validAmount = true;
        if (val <= 0) {
            validAmount = false;
        } else if (val + FEE > balance) {
            validAmount = false;
        }
        if (validAmount) {
            $('#amountAlert').slideUp();
        } else {
            $('#amountAlert').slideDown();
        }

        var regex = /^[13][1-9A-HJ-NP-Za-km-z]{26,33}$/;
        var validAddress = true;
        if (!regex.test(String(address))) {
            validAddress = false;
        } else {
            try {
                new Bitcoin.Address(address);
            } catch (e) {
                validAddress = false;
            }
        }

        if (validAddress) {
            $('#addressAlert').slideUp();
        } else {
            $('#addressAlert').slideDown();
        }

        if (validAddress && validAmount) {
            if (wallet.isEncrypted()) {
                currencyManager.formatAmount(val).then(function(formattedMoney) {
                    var text = 'Are you sure you want to send<br />' + val / BTCMultiplier + ' ' + BTCUnits + ' (<strong>' + formattedMoney + '</strong>)<br />to ' + address + ' ?';
                    $('#sendConfirmationText').html(text);
                    $('#sendConfirmationPassword').val(null);
                    $('#sendConfirmationPasswordIncorrect').hide();
                    $('#sendConfirmationModal').modal().show();
                });
            } else {
                confirmSend();
            }
        }
    });

    $('#confirmSendButton').click(function() {
        confirmSend();
    });

    function confirmSend() {
        $('#cover').show();
        var password = $('#sendConfirmationPassword').val();
        wallet.mulitpleOutputsSend([{
            txDest: address,
            txSatoshis: val
        }], FEE, password).then(function() {
            //wallet.send(address, val, FEE, password).then(function () {
            $('#amount').val(null);
            $('#sendAddress').val(null);
            $('#amountLabel').text('Amount:');
            var text = 'Sent ' + val / BTCMultiplier + ' ' + BTCUnits + ' to ' + address + '.';
            $('#successAlertLabel').text(text);
            $('#successAlert').slideDown();
            $('#sendConfirmationModal').modal('hide');
            $('#cover').fadeOut('slow');
        }, function(e) {
            if (wallet.isEncrypted()) {
                $('#sendConfirmationPasswordIncorrect').text(e.message).slideDown();
            } else {
                $('#unknownErrorAlertLabel').text(e.message);
                $('#unknownErrorAlert').slideDown();
            }
            $('#cover').hide();
        });
    }

    function subscriptions() {
        return new Promise(function(resolve, reject) {
            var subscriptions = [];
            db.values('subscriptions').done(function(records) {
                for (var i in records) {
                    subscriptions.push({
                        txDest: records[i].bitcoinAddress.trim(),
                        amountFiat: records[i].amountFiat,
                        currencyCode: localStorage['fiatCurrencyCode'],
                        paymentType: 'subscription'
                    });
                }
                resolve(subscriptions);
            });
        });
    }

    function browsing() {
        return new Promise(function(resolve, reject) {
            var sites = [];
            db.values('sites').done(function(records) {
                localStorage['totalTime'] = 0;
                for (var i in records) {
                    if (records[i].timeOnPage) {
                        localStorage['totalTime'] = parseInt(localStorage['totalTime']) + parseInt(records[i].timeOnPage);
                    }
                };
                for (var i in records) {
                    var slice = (records[i].timeOnPage / localStorage['totalTime']).toFixed(2);
                    var amountFiat = (slice * parseFloat(localStorage["incidentalTotalFiat"])).toFixed(2);
                    if (amountFiat > 0) {
                        sites.push({
                            txDest: records[i].bitcoinAddress.trim(),
                            amountFiat: amountFiat,
                            currencyCode: localStorage['fiatCurrencyCode'],
                            paymentType: 'browsing'
                        });
                    }
                }
                resolve(sites);
            });
        });
    }

    function makePayments() {
        localStorage['weeklyAlarmReminder'] = false;
        chrome.browserAction.setBadgeText({
            text: ''
        });

        Promise.all([
            preferences.setCurrency(localStorage['fiatCurrencyCode']),
            preferences.getExchangeRate(),
            browsing(),
            subscriptions()
        ]).then(function(result) {
            var exchangeRate = result[1];
            var browsing = result[2];
            var subscriptions = result[3];

            var totalWeeklyBudget = parseInt(parseFloat(localStorage['totalWeeklyBudgetFiat']) / exchangeRate * SATOSHIS);
            totalWeeklyBudget += FEE;

            if ((wallet.getBalance() + FEE) <= totalWeeklyBudget) {
                totalWeeklyBudget = parseInt(wallet.getBalance()); // If insufficent funds just pay what can be paid.
            }

            // Add the payments *upto* fiat budget.
            // Should always match, but this is just a extra check.
            var paymentObjs = [];

            var txTotalSatoshis = 0;

            for (i in subscriptions) { // tally up subscriptions as first priority
                subscriptions[i].exchangeRate = exchangeRate;
                satoshisAsFloat = (parseFloat(subscriptions[i].amountFiat) / exchangeRate) * SATOSHIS;
                subscriptions[i].txSatoshis = parseInt(satoshisAsFloat);
                txTotalSatoshis += subscriptions[i].txSatoshis;
            }

            subscriptions = _.sortBy(subscriptions, 'txSatoshis').reverse(); // sort descending
            // Most browsers do return properties in the same order as they were inserted,
            // but it is explicitly not guaranteed behaviour so you should not rely upon it.
            // In particular see section 12.6.4 of the ECMAScript specification:
            for (var i = 0; i < subscriptions.length; i++) {
                if (txTotalSatoshis > totalWeeklyBudget) {
                    console.log('---------------');
                    console.log('budget exceeded');
                    console.log('current total =' + txTotalSatoshis);
                    console.log(subscriptions[i]);
                    console.log('---------------');
                    break;
                }
                paymentObjs.push(subscriptions[i]);
            }


            // NOW DO BROWSING SITES
            for (i in browsing) { // tally up sites as second priority
                browsing[i].exchangeRate = exchangeRate;
                satoshisAsFloat = (parseFloat(browsing[i].amountFiat) / exchangeRate) * SATOSHIS;
                browsing[i].txSatoshis = parseInt(satoshisAsFloat);
                txTotalSatoshis += browsing[i].txSatoshis;
            }

            browsing = _.sortBy(browsing, 'txSatoshis').reverse(); // sort descending
            // Most browsers do return properties in the same order as they were inserted,
            // but it is explicitly not guaranteed behaviour.
            // In particular see section 12.6.4 of the ECMAScript specification:
            for (var i = 0; i < browsing.length; i++) {
                if (txTotalSatoshis > totalWeeklyBudget) {
                    console.log('---------------');
                    console.log('budget exceeded');
                    console.log('current total =' + txTotalSatoshis);
                    console.log(browsing[i]);
                    console.log('---------------');
                    break;
                }
                paymentObjs.push(browsing[i]);
            }

            wallet.mulitpleOutputsSend(paymentObjs, FEE, '').then(function() {
                alert('sent');
            });
        });
    }

    $('#confirm-donate-now').click(function() {
        localStorage['weeklyAlarmReminder'] = false;
        chrome.browserAction.setBadgeText({
            text: ''
        });
        makePayments();
    });

    /*
     *  Settings Menu
     */

    /*
     * Set Password
     */
    $('#setPassword').click(function() {
        $('#passwordMismatch').hide();
        $('#setPasswordIncorrect').hide();
        $('#setPasswordBlank').hide();
        if (wallet.isEncrypted()) {
            $('#removePasswordDiv').show();
            $('#setPasswordPassword').show().val(null);
        } else {
            $('#removePasswordDiv').hide();
            $('#setPasswordPassword').hide().val(null);
        }
        $('#newPassword').show().val(null);
        $('#confirmNewPassword').show().val(null);
        $('#removePassword').attr('checked', false);
        $('#setPasswordModal').modal().show();
    });

    $('#removePassword').click(function() {
        if (this.checked) {
            $('#newPassword').val(null).slideUp();
            $('#confirmNewPassword').val(null).slideUp();
        } else {
            $('#newPassword').slideDown();
            $('#confirmNewPassword').slideDown();
        }
    });

    $('#confirmSetPassword').click(function() {
        var password = $('#setPasswordPassword').val(),
            newPassword = $('#newPassword').val(),
            confirmNewPassword = $('#confirmNewPassword').val();
        var validInput = true;
        if ((wallet.isEncrypted() && !password) || (!$('#removePassword').is(':checked') && (!newPassword || !confirmNewPassword))) {
            validInput = false;
            $('#setPasswordBlank').slideDown();
        } else {
            $('#setPasswordBlank').slideUp();
        }

        if (validInput && newPassword !== confirmNewPassword) {
            validInput = false;
            $('#passwordMismatch').slideDown();
        } else {
            $('#passwordMismatch').slideUp();
        }

        if (validInput && wallet.isEncrypted() && !wallet.validatePassword(password)) {
            validInput = false;
            $('#setPasswordIncorrect').slideDown();
        } else {
            $('#setPasswordIncorrect').slideUp();
        }

        if (validInput) {
            wallet.updatePassword(String(password), String(newPassword)).then(function() {
                $('#successAlertLabel').text('New password set.');
                $('#successAlert').show();
                $('#setPasswordModal').modal('hide');
            });
        }

    });

    /*
     * Currency selection
     */
    $('#setCurrency').click(function() {
        preferences.getCurrency().then(function(currency) {
            var currencies = currencyManager.getAvailableCurrencies();
            var tableBody = '';
            for (var i = 0; i < currencies.length / 3; i++) {
                tableBody += '<tr>';
                for (var j = i; j <= i + 12; j += 6) {
                    tableBody += '<td><div class="radio no-padding"><label><input type="radio" name="' + currencies[j] + '"';
                    if (currencies[j] === currency) {
                        tableBody += ' checked';
                    }
                    tableBody += '>' + currencies[j] + '</label></div></td>';
                }
                tableBody += '</tr>';
            }
            $('#tableBody').html(tableBody);
            $('#setCurrencyModal').modal().show();
            $('.radio').click(function() {
                var currency = $.trim($(this).text());
                $('input:radio[name=' + currency + ']').attr('checked', 'checked');
                preferences.setCurrency(currency).then(function() {
                    $('#amountLabel').text('Amount:');
                    $('#successAlertLabel').text('Currency set to ' + currency + '.');
                    $('#successAlert').show();
                    $('#setCurrencyModal').modal('hide');
                });
            });
        });
    });

    /*
     * Units selection
     */
    $('#setUnits').click(function() {
        preferences.getBTCUnits().then(function(units) {
            var availableUnits = ['BTC', 'mBTC', 'µBTC'];
            var tableBody = '<tr>';
            for (var i = 0; i < availableUnits.length; i++) {
                tableBody += '<td><div class="radio no-padding"><label><input type="radio" name="' + availableUnits[i] + '"';
                if (availableUnits[i] === units) {
                    tableBody += ' checked';
                }
                tableBody += '>' + availableUnits[i] + '</label></div></td>';
            }
            tableBody += '</tr>';
            $('#tableBody').html(tableBody);
            $('#setCurrencyModal').modal().show();
            $('.radio').click(function() {
                var units = $.trim($(this).text());
                $('input:radio[name=' + units + ']').attr('checked', 'checked');
                setBTCUnits(units);
                preferences.setBTCUnits(units).then(function() {
                    $('#successAlertLabel').text('Units set to ' + units + '.');
                    $('#successAlert').show();
                    $('#setCurrencyModal').modal('hide');
                });
            });
        });
    });

    /*
     *  Show Private Key
     */
    $('#showPrivateKey').click(function() {
        $('#showPrivateKeyPasswordIncorrect').hide();
        if (wallet.isEncrypted()) {
            $('#showPrivateKeyPassword').val(null).show();
        } else {
            $('#showPrivateKeyPassword').hide();
        }
        $('#privateKey').hide();
        $('#showPrivateKeyModal').modal().show();
    });

    $('#showPrivateKeyConfirm').click(function() {
        var password = $('#showPrivateKeyPassword').val();
        if (wallet.isEncrypted() && !wallet.validatePassword(password)) {
            $('#showPrivateKeyPasswordIncorrect').slideDown();
        } else {
            $('#showPrivateKeyPasswordIncorrect').slideUp();
            var privateKey = wallet.getDecryptedPrivateKey(password);
            $('#privateKeyQRCode').html(createQRCodeCanvas(privateKey));
            $('#privateKeyText').text(privateKey);
            $('#privateKey').slideDown(function() {
                $('#main').height($('#showPrivateKeyModal').find('.modal-dialog').height());
            });
        }
    });

    /*
     *  Import Private Key
     */
    $('#importPrivateKey').click(function() {
        $('#importPrivateKeyPasswordIncorrect').hide();
        $('#importPrivateKeyBadPrivateKey').hide();
        if (wallet.isEncrypted()) {
            $('#importPrivateKeyPassword').val(null).show();
        } else {
            $('#importPrivateKeyPassword').hide();
        }
        $('#importPrivateKeyPrivateKey').val(null);
        $('#importPrivateKeyModal').modal().show();
    });

    $('#importPrivateKeyConfirm').click(function() {
        var privateKey = $('#importPrivateKeyPrivateKey').val();
        try {
            new Bitcoin.ECKey(privateKey).getExportedPrivateKey();
        } catch (e) {
            $('#importPrivateKeyBadPrivateKey').slideDown();
            return;
        }
        wallet.importAddress($('#importPrivateKeyPassword').val(), privateKey).then(function() {
            setupWallet();
            $('#successAlertLabel').text('Private key imported successfully.');
            $('#successAlert').show();
            $('#importPrivateKeyModal').modal('hide');
        }, function(e) {
            if (e.message === 'Incorrect password') {
                $('#importPrivateKeyBadPrivateKey').slideUp();
                $('#importPrivateKeyPasswordIncorrect').slideDown();
            } else {
                $('#importPrivateKeyPasswordIncorrect').slideUp();
                $('#importPrivateKeyBadPrivateKey').slideDown();
            }
        });
    });

    /*
     *  Generate New Wallet
     */
    $('#generateNewWallet').click(function() {
        $('#generateNewWalletPasswordIncorrect').hide();
        if (wallet.isEncrypted()) {
            $('#generateNewWalletPassword').show().val(null);
        } else {
            $('#generateNewWalletPassword').hide();
        }
        $('#generateNewWalletModal').modal().show();
    });

    $('#generateNewWalletConfirm').click(function() {
        wallet.generateAddress($('#generateNewWalletPassword').val()).then(function() {
            setupWallet();
            $('#successAlertLabel').text('New wallet generated.');
            $('#successAlert').show();
            $('#generateNewWalletModal').modal('hide');
        }, function() {
            $('#generateNewWalletPasswordIncorrect').slideDown();
        });
    });

    /*
     * About
     */

    if (typeof chrome !== 'undefined') {
        $('#version').text(chrome.runtime.getManifest().version);
    } else {
        addon.port.on('version', function(version) {
            $('#version').text(version);
        });
    }

    $('#aboutModal').on('click', 'a', function() {
        if (typeof chrome !== 'undefined') {
            chrome.tabs.create({
                url: $(this).attr('href')
            });
        } else {
            addon.port.emit('openTab', $(this).attr('href'));
        }
        return false;
    });

    /*
     * Resizing
     */

    $('.modal').on('shown.bs.modal', function() {
        var $main = $('#main');
        var height = $main.height();
        var modalHeight = $(this).find('.modal-dialog').height();
        if (modalHeight > height) {
            $main.height(modalHeight);
            if (typeof chrome === 'undefined') {
                addon.port.emit('resize', modalHeight + 2);
            }
        }
    }).on('hidden.bs.modal', function() {
        $('#main').height('auto');
        if (typeof chrome === 'undefined') {
            if ($('#successAlert').is(':visible')) {
                var height = 350;
            } else {
                var height = 278;
            }
            addon.port.emit('resize', height);
        }
    });

    function createQRCodeCanvas(text) {
        var sizeMultiplier = 4;
        var typeNumber;
        var lengthCalculation = text.length * 8 + 12;
        if (lengthCalculation < 72) {
            typeNumber = 1;
        } else if (lengthCalculation < 128) {
            typeNumber = 2;
        } else if (lengthCalculation < 208) {
            typeNumber = 3;
        } else if (lengthCalculation < 288) {
            typeNumber = 4;
        } else if (lengthCalculation < 368) {
            typeNumber = 5;
        } else if (lengthCalculation < 480) {
            typeNumber = 6;
        } else if (lengthCalculation < 528) {
            typeNumber = 7;
        } else if (lengthCalculation < 688) {
            typeNumber = 8;
        } else if (lengthCalculation < 800) {
            typeNumber = 9;
        } else if (lengthCalculation < 976) {
            typeNumber = 10;
        }
        var qrcode = new QRCode(typeNumber, QRCode.ErrorCorrectLevel.H);
        qrcode.addData(text);
        qrcode.make();
        var width = qrcode.getModuleCount() * sizeMultiplier;
        var height = qrcode.getModuleCount() * sizeMultiplier;
        // create canvas element
        var canvas = document.createElement('canvas');
        var scale = 10.0;
        canvas.width = width * scale;
        canvas.height = height * scale;
        canvas.style.width = width + 'px';
        canvas.style.height = height + 'px';
        var ctx = canvas.getContext('2d');
        ctx.scale(scale, scale);
        // compute tileW/tileH based on width/height
        var tileW = width / qrcode.getModuleCount();
        var tileH = height / qrcode.getModuleCount();
        // draw in the canvas
        for (var row = 0; row < qrcode.getModuleCount(); row++) {
            for (var col = 0; col < qrcode.getModuleCount(); col++) {
                ctx.fillStyle = qrcode.isDark(row, col) ? "#000000" : "#ffffff";
                ctx.fillRect(col * tileW, row * tileH, tileW, tileH);
            }
        }
        return canvas;
    }

    // $('#toggle-alarm').click(function() {
    //     doToggleAlarm();
    //     restartTheWeek();
    // });

    $('#incidental-fiat-amount').change(function() {
        localStorage['incidentalTotalFiat'] = $(this).val();
        var availableBalanceFiat = parseFloat(localStorage['availableBalanceFiat']);
        var bitcoinFeeFiat = parseFloat(localStorage['bitcoinFeeFiat']);
        var totalSubscriptionsFiat = parseFloat(localStorage['subscriptionTotalFiat']);
        var incidentalTotalFiat = parseFloat($(this).val());

        var weeklyTotalFiat = bitcoinFeeFiat + totalSubscriptionsFiat + incidentalTotalFiat;
        // if (availableBalanceFiat > 0 && weeklyTotalFiat > availableBalanceFiat - bitcoinFeeFiat) {
        //     weeklyTotalFiat = availableBalanceFiat - bitcoinFeeFiat;
        //     $(this).attr('max', incidentalTotalFiat);
        // }
        var balanceCoversXWeeks = (availableBalanceFiat - weeklyTotalFiat) / weeklyTotalFiat;
        if (balanceCoversXWeeks < 0) {
            balanceCoversXWeeks = 0
        } // initalization with empty wallet.

        $('#balance-covers-weeks').html(balanceCoversXWeeks.toFixed(1));
        $('#balance-covers-weeks').effect("highlight", {
            color: 'rgb(100, 189, 99)'
        }, 400);

        $('#total-fiat-amount').html(parseFloat(weeklyTotalFiat).toFixed(2)); // use standard money formattor
        $( "#slider" ).slider({value: $(this).val() });
        //refreshTotalCoffeeCupProgressBar('total-amount-progress-bar');
    });

    $("input[name=remind-me]:radio").change(function(value) {
        if (this.value == 'automaticDonate') {
            $('#automatic-donate-container').toggleClass('list-group-item-success');
            $('#manual-remind-container').toggleClass('list-group-item-success');
            localStorage['automaticDonate'] = true;
            localStorage['manualRemind'] = false;
        } else {
            $('#automatic-donate-container').toggleClass('list-group-item-success');
            $('#manual-remind-container').toggleClass('list-group-item-success');
            localStorage['automaticDonate'] = false;
            localStorage['manualRemind'] = true;
        }
    });

    $('#confirm-donate-now').click(function() {
        //$(this).button('loading');
        restartTheWeek();
        //db.clear('sites');
        $('#confirm-donate-now').button('reset')
        $('#browsing-table').fadeOut();
        $('#browsing-table').empty();
        $('#confirm-donate-now-dialogue').slideUp().fadeOut();
    });

    $('#donate-now').click(function() {
        var totalFiatAmount = parseFloat($('#total-fiat-amount').html());
        var currentBalance = parseFloat(localStorage['availableBalanceFiat']);
        if (totalFiatAmount > currentBalance) {
            $('#insufficient-funds-dialogue').slideDown().fadeIn();
        } else {
            $('#confirm-donate-now-dialogue').slideDown().fadeIn();
        }
    });

    $('#confirm-donate-cancel').click(function() {
        $('#confirm-donate-now-dialogue').slideUp().fadeOut();
    });

    $("#reset-manual-timer").click(function() {
        restartTheWeek()
    });
    $("#reset-automatic-timer").click(function() {
        restartTheWeek()
    });


});

