const express = require('express');
const router = express.Router();
const Meeting = require('../models/Meeting');
const { protect } = require('../middleware/auth');

router.use(protect);

// GET /api/meetings
router.get('/', async (req, res) => {
  try {
    const meetings = await Meeting.find({
      $or: [{ organizer: req.user._id }, { participants: req.user._id }]
    })
      .populate('organizer', 'name avatar')
      .populate('participants', 'name avatar')
      .sort({ scheduledAt: -1 });
    res.json({ success: true, meetings });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/meetings
router.post('/', async (req, res) => {
  try {
    const meeting = await Meeting.create({ ...req.body, organizer: req.user._id });
    await meeting.populate('organizer participants', 'name avatar');
    res.status(201).json({ success: true, meeting });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/meetings/:id
router.put('/:id', async (req, res) => {
  try {
    const meeting = await Meeting.findOneAndUpdate(
      { _id: req.params.id, organizer: req.user._id },
      req.body, { new: true }
    ).populate('organizer participants', 'name avatar');
    if (!meeting) return res.status(404).json({ success: false, message: 'Meeting not found' });
    res.json({ success: true, meeting });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/meetings/:id
router.delete('/:id', async (req, res) => {
  try {
    await Meeting.findOneAndDelete({ _id: req.params.id, organizer: req.user._id });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
