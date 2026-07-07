app.factory('SignupPreviewService', SignupPreviewService);

    SignupPreviewService.$inject = ['EnvConfig'];
    function SignupPreviewService(EnvConfig) {

        // Design-preview harness for the signup / invitation flows.
        //
        // Tokens beginning with "preview" load the REAL wizards with the
        // sample data below instead of calling the API, and every submit is
        // simulated locally (success screens shown, nothing sent), so all
        // steps of every variant can be reviewed without a backend-issued
        // invitation. NEVER active in a production build.
        //
        //   /invitations/preview-paid          paid membership, direct debit only
        //   /invitations/preview-paid-card     paid membership, club has Stripe
        //   /invitations/preview-free          free membership (skip option)
        //   /invitations/preview-deferred      paid, first payment deferred
        //   /passenger_signup/preview          new passenger (any 6-digit code)
        //   /passenger_signup/preview-user     passenger who is already a user
        //   /passenger_signup_complete/preview returning passenger (any code)
        //   /signup/maintenance?invite=preview maintenance org, invited by club

        var service = {};
        service.IsPreview = IsPreview;
        service.GetInvitation = GetInvitation;
        service.GetPaxInvitation = GetPaxInvitation;
        service.GetMaintenanceInvite = GetMaintenanceInvite;
        return service;

        function IsPreview(token) {
            if (EnvConfig.isProduction()) { return false; }
            return !!token && String(token).indexOf('preview') === 0;
        }

        // ── Member invitation (/invitations/:token) ──
        // Shape mirrors GET /api/v1/invitations/:token
        function GetInvitation(token) {
            if (!IsPreview(token)) { return null; }

            var base = {
                first_name: 'Amelia',
                last_name: 'Earhart',
                email: 'amelia.preview@example.com',
                membership_id: 1,
                club_id: 1,
                to_pay: 1,
                user_id: 0,
                invitation_token: token,
                invited_by: 'Preview Club Admin',
                membership_request_id: 0,
                payment_now: 1,
                first_payment: '',
                club: {
                    title: 'Preview Flying Club',
                    club_stripe_id: ''
                },
                membership: {
                    membership_name: 'Full Flying Membership',
                    price: 240,
                    currency: 'GBP',
                    payment_term: 'Annually',
                    request: {
                        membership_start: '2026-08-01',
                        membership_end: '2027-07-31'
                    }
                }
            };

            if (token === 'preview-paid-card') {
                base.club.club_stripe_id = 'acct_preview';
            }
            if (token === 'preview-free') {
                base.membership.membership_name = 'Social Membership';
                base.membership.price = 0;
                base.to_pay = 0;
            }
            if (token === 'preview-deferred') {
                base.payment_now = 0;
                base.first_payment = '2026-09-01';
            }
            return base;
        }

        // ── Passenger invitation (/passenger_signup/:token and
        //    /passenger_signup_complete/:token) ──
        // Shape mirrors data.invitation from the secure-invite endpoints.
        function GetPaxInvitation(token) {
            if (!IsPreview(token)) { return null; }

            if (token === 'preview-user') {
                return {
                    is_already_user: true,
                    user_id: 1,
                    membership_id: 0,
                    club_id: 1,
                    invitation_token: token,
                    status: 'pending',
                    invited_by: 'Preview Pilot',
                    booking_id: 0,
                    club: { title: 'Preview Flying Club' },
                    user: {
                        first_name: 'Charles',
                        last_name: 'Lindbergh',
                        email: 'charles.preview@example.com',
                        dob: '1990-05-21',
                        guardian: { first_name: '' },
                        nok: {
                            first_name: 'Anne',
                            last_name: 'Lindbergh',
                            phone_number: '+447700900123',
                            email_address: 'anne.preview@example.com',
                            relationship: 'Spouse',
                            address: '1 Airfield Lane, Preview, PR3 1VW'
                        }
                    }
                };
            }

            return {
                is_already_user: false,
                membership_id: 0,
                club_id: 1,
                invitation_token: token,
                status: 'pending',
                invited_by: 'Preview Pilot',
                booking_id: 0,
                club: { title: 'Preview Flying Club' },
                first_name: 'Bessie',
                last_name: 'Coleman',
                email: 'bessie.preview@example.com'
            };
        }

        // ── Maintenance organisation invite (?invite=preview) ──
        // Shape mirrors res.invite from GET /maintenance_organisations/invite/:token
        function GetMaintenanceInvite(token) {
            if (!IsPreview(token)) { return null; }
            return {
                token: token,
                email: 'engineering.preview@example.com',
                organisation_name: 'Preview Aero Engineering Ltd',
                club_title: 'Preview Flying Club',
                plane_registration: 'G-PREV',
                message: 'Hi — could you look after our PA-28? Thanks!',
                inviter_name: 'Preview Club Admin'
            };
        }
    }
