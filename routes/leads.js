const express = require('express');
const router = express.Router();
const Lead = require('../models/Lead');
const { sendLeadNotificationEmail, sendGenericThankYouEmail } = require('../utils/email');

// @route   POST /api/leads
// @desc    Create a new lead (public)
router.post('/', async (req, res) => {
    try {
        const { name, email, phone, message } = req.body;
        
        if (!name || !email || !phone) {
            return res.status(400).json({ success: false, message: 'Please provide all required fields.' });
        }

        const newLead = new Lead({
            name,
            email,
            phone,
            message
        });

        await newLead.save();

        try {
            await sendLeadNotificationEmail({
                leadType: 'Contact Page Lead',
                leadDetails: {
                    Name: name,
                    Email: email,
                    Phone: phone,
                },
                message: message,
            });
        } catch (mailErr) {
            console.error('Failed to send lead notification email:', mailErr);
        }

        try {
            await sendGenericThankYouEmail({
                to: email,
                name: name,
                type: 'Contact',
            });
        } catch (thankYouErr) {
            console.error('Failed to send thank you email:', thankYouErr);
        }

        res.status(201).json({ success: true, message: 'Lead submitted successfully.' });
    } catch (error) {
        console.error('Lead creation error:', error);
        res.status(500).json({ success: false, message: 'Server error while submitting lead.' });
    }
});

// @route   GET /api/leads
// @desc    Get all leads (admin)
router.get('/', async (req, res) => {
    try {
        const leads = await Lead.find().sort({ createdAt: -1 });
        res.json({ success: true, leads });
    } catch (error) {
        console.error('Fetch leads error:', error);
        res.status(500).json({ success: false, message: 'Server error while fetching leads.' });
    }
});

// @route   PUT /api/leads/:id
// @desc    Update lead status (admin)
router.put('/:id', async (req, res) => {
    try {
        const { status } = req.body;
        const lead = await Lead.findByIdAndUpdate(
            req.params.id,
            { status },
            { new: true }
        );

        if (!lead) {
            return res.status(404).json({ success: false, message: 'Lead not found.' });
        }

        res.json({ success: true, lead });
    } catch (error) {
        console.error('Update lead error:', error);
        res.status(500).json({ success: false, message: 'Server error while updating lead.' });
    }
});

// @route   DELETE /api/leads/:id
// @desc    Delete a lead (admin)
router.delete('/:id', async (req, res) => {
    try {
        const lead = await Lead.findByIdAndDelete(req.params.id);
        if (!lead) {
            return res.status(404).json({ success: false, message: 'Lead not found.' });
        }
        res.json({ success: true, message: 'Lead deleted successfully.' });
    } catch (error) {
        console.error('Delete lead error:', error);
        res.status(500).json({ success: false, message: 'Server error while deleting lead.' });
    }
});

module.exports = router;
