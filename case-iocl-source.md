## IOCL Generic Cards: Designing fallback with out making it the default

### Context
BlackBuck has a business vertical that deals with diesel cards. It partners with oil companies and makes fuel cards available for it's users which they can use in petrol pumps while purchasing fuel and earn rewards on it.

This particular instance that we are going to talk about is regarding IOCL and their fuel card. In the case of IOCL, once a customer successfully verifies and purchases a fuel card they are assigned a Customer ID (CID). Upon this Customer ID multiple cards can be issued.

## Why are we talking about IOCL?
While business reviewed the insights regarding their existing fuel card purchase journey for IOCL, it was noted that only 52% of the users that started the purchase journey could end up completing it. Rest 48% were getting stuck. 
This case study isn't just about improving that metric but it's also about how a solution that could've gone wrong was shaped by design to go right. Hence, focussing on the importance of friction and how appropriate use of it can be a guide rather than a pain. Before moving forward, let's go ahead and take a look at the purchase flow.

## The problem we were tackling
When the 48% was split, we observed that
- Truck owner mobile number and KYC verification before docs are sent to Ops Portal for verification - **23% drop  
- Fuel KYC validation and IOCL API rejections - **17% drop
- CID created but card creation fails - **8% drop

## The proposed solution
Generic cards solve this by bypassing Customer ID (CID) creation entirely. Instead of issuing a card under the truck owner's identity, the card is created under BlackBuck's own CID. The card works immediately for fuel transactions, and these cards undergo manual KYC verification going forward.

However, the card also carried layers of risk as they were operating under BlackBuck's CID rather than the truck owner's, with manual KYC verification post-issuance. Considering this, generic cards needed to be strictly treated as a fallback.

This is where design came into play to understand the behavioural risks and create appropriate friction to make sure the exception road didn't become the highway.

## Understanding the behaviour of customers and agents
We have two parts two tackle in the formation of this solution.
1. Mobile application changes for customers
2. Ops portal changes for agents

Now to design for these users, we have to understand their behaviours. Let's start with the customer behaviour first. Customers are primarily tier 2/ tier 3 truck drivers or fleet owners with low digital literacy. From what i've understood through customer callings and interviews is that linear flows work for them. They are also instinctually curious, as in they navigate by tapping what's prominent, not by reading what's correct. So, in order to give the users a chance to move ahead with the creation of their own CID as the primary flow, we need to adapt a sequencing mode of design for the generic card fallback. The fallback should arrive as a rescue that is visible visible only after the primary path has genuinely failed, not as a competing option from the start.
[[Friction.png]]

And for the agents, it is an open secret that agents aren't rewarded for their ability to be thorough with their checks. They are incentivised by speed instead. An agent going through 500-1000 applications per day would unintentionally skip the path of more effort. Not because they're lazy in nature but because they follow the path of least resistance to achieve their goals and targets quicker. So, the fallback should feel intentional, structured, and accountable. This doesn’t necessarily mean to hide the feature, but instead introduce some friction. Friction which would act as a guardrail and remind agents that it is a fallback feature.

## The designs for mobile app
[[Surfacing fallback.png]]
The standard IOCL card creation flow starts with consent, moves through application details, and arrives at OTP verification. This is where 23% of users were dropping off. The OTP either didn't arrive or arrived for the wrong number. The generic card option is not shown at the beginning of the flow, or even at the OTP screen when it first loads. It only appears after the 60-second countdown expires — as an orange banner at the bottom of the OTP bottom screen. By that point the user has already waited, already tried, and is already frustrated. 
*The fallback arrives as a contextually relevant solution, not a shortcut that competes with the primary flow.*

## The designs for the ops portal
The ops portal is where agents review applications and create CIDs for truck owners. 83% of cases are routine. The other 17% hit exceptions with unclear documents and minor KYC mismatches. This is where the agent needs a way to still move the application forward.

For this, generic card creation exists on the portal too. Agents must select a structured reason for routing to generic, and explicitly give consent via a checkbox that they have reviewed all submitted documents. It's not a wall. It's a moment of declared accountability before a non-standard decision.

Post-launch data validates this. Since December 2025, generic card creation has held at **10–16% of total card issuances every month, never approaching the CID path volume.** The friction worked — not by blocking agents, but by making the exception feel like an exception.

## The Impact

[[impact_2.png]]
**Before Release (Sep–Nov '25):** End-to-end card creation conversion sat at **16–25%** of applications initiated.

**After Release (Dec '25 onwards):** Conversion rose to **30–49%**.

The generic card flow gave ops a legitimate, documented path for the 17% of applications that previously had nowhere to go. Every exception is now logged with a stated reason and an explicit consent action, all the while creating an audit trail that enhanced accountability. Moreover, **Generic card creation has consistently stayed within the 10–16% range month over month**. This is a signal that the fallback is being used as designed, not as a workaround.




