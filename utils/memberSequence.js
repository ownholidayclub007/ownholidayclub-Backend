const MemberSequence = require("../models/MemberSequence");
const { getStateCode } = require("./membership");

const getNextMembershipSequence = async (state) => {
  const stateCode = getStateCode(state);
  const existingSequence = await MemberSequence.findOneAndUpdate(
    { stateCode },
    { $inc: { nextValue: 1 } },
    { new: true },
  );

  if (existingSequence) {
    return existingSequence.nextValue;
  }

  try {
    const createdSequence = await MemberSequence.create({
      stateCode,
      nextValue: 10001,
    });
    return createdSequence.nextValue;
  } catch (error) {
    if (error?.code !== 11000) {
      throw error;
    }

    const retrySequence = await MemberSequence.findOneAndUpdate(
      { stateCode },
      { $inc: { nextValue: 1 } },
      { new: true },
    );
    return retrySequence?.nextValue || 10001;
  }
};

module.exports = { getNextMembershipSequence };
