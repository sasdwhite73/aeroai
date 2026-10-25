Everything above the first "##" line is ignored by AeroAI.
Replace the sample notes below with your own. Start each note with "## Note title".

## Normal shock: pressure ratio
Assumptions: steady, 1D, adiabatic flow of a calorically perfect gas across a stationary normal shock, with no body forces.
Starting from conservation of mass, momentum and energy across the shock, the static pressure ratio is:
p2/p1 = 1 + (2*gamma/(gamma+1)) * (M1^2 - 1)
The flow downstream is always subsonic, and total pressure drops across the shock.

## Isentropic stagnation relations
For steady, adiabatic, reversible flow of a calorically perfect gas:
T0/T = 1 + ((gamma-1)/2) * M^2
p0/p = (T0/T)^(gamma/(gamma-1))
These come from the energy equation (h0 = h + V^2/2) combined with the isentropic relation between p and T.

## Lift equation
Lift is written as L = 0.5 * rho * V^2 * S * CL, where rho is air density, V is true airspeed, S is wing reference area and CL is the lift coefficient.
CL depends on angle of attack, airfoil shape, Mach number and Reynolds number.

## Wing materials: quick tradeoffs
Aluminum alloys are cheap, easy to machine and well understood, but have limited fatigue life compared with composites.
Carbon fiber composites give high stiffness-to-weight, but are costlier to manufacture and inspect.
Titanium offers excellent strength and corrosion resistance at high temperature, but is expensive and hard to machine.


## Rocket equation (Tsiolkovsky)
Assumptions: a single rocket in a straight line, no gravity or drag, and a constant exhaust velocity ve relative to the vehicle.
Apply conservation of momentum to the rocket and the exhaust it expels. This gives m * dv = -ve * dm, where m is the instantaneous vehicle mass.
Integrating from initial mass m0 to final mass mf gives:
delta_v = ve * ln(m0/mf)
Exhaust velocity is related to specific impulse by ve = Isp * g0, with g0 = 9.80665 m/s^2.
In real launches, gravity and drag losses must be subtracted from the ideal delta_v.

## Isentropic area-Mach relation
Assumptions: steady, quasi-1D, isentropic flow of a calorically perfect gas through a duct of varying area.
Combining continuity, momentum and energy gives the area-velocity relation dA/A = (M^2 - 1) * dV/V.
This means a subsonic flow speeds up in a converging duct and a supersonic flow speeds up in a diverging duct.
Integrating from the sonic throat, where A = A*, gives:
A/A* = (1/M) * [ (2/(gamma+1)) * (1 + ((gamma-1)/2) * M^2) ]^((gamma+1)/(2*(gamma-1)))
For each A/A* greater than 1 there are two solutions: one subsonic and one supersonic.

## Drag polar and maximum L/D
Assumptions: subsonic flight and a roughly parabolic relation between drag and lift.
The total drag coefficient is the sum of parasite drag and lift-induced drag:
CD = CD0 + k * CL^2
Here CD0 is the zero-lift drag coefficient, and k = 1/(pi * e * AR), where AR is the wing aspect ratio and e is the Oswald efficiency factor, typically about 0.7 to 0.85.
Setting the derivative of CL/CD with respect to CL equal to zero gives the best glide condition:
CL = sqrt(CD0/k), and (L/D)max = 1 / (2 * sqrt(CD0 * k))
At this point, parasite drag equals induced drag.

## Setting up a 2D airfoil in CAD
This is a general workflow, so the exact commands depend on your CAD software.
1. Get the airfoil coordinates, either from a data file (for example a NACA 4-digit profile) or by computing them from the NACA thickness and camber equations. The coordinates are normalized to a chord length of 1.
2. Import the points, or enter them as a table, and fit a single smooth spline through them. Use one spline for the upper surface and one for the lower surface if your software handles a sharp leading edge better that way.
3. Close the trailing edge. Many tabulated airfoils end with a small gap, so either join the end points with a line or modify the last points so the surface closes cleanly.
4. Scale the sketch to your real chord length.
5. Check the sketch for gaps or overlapping curves before extruding it into a wing section or lofting several sections into a wing.
